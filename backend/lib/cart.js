import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import prisma from "../directory/prisma/prisma.js";
import { authenticateRequest } from "../directory/auth/auth.js";

export const CART_COOKIE_NAME = "cart_session_id";

export async function resolveCart(request) {
    const auth = await authenticateRequest(request);

    if (auth.authenticated) {
        let cart = await prisma.cart.findUnique({
            where: { userId: auth.user.userId },
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId: auth.user.userId },
            });
        }

        return {
            cart,
            isGuest: false,
            userId: auth.user.userId,
        };
    }

    const cookieStore = await cookies();

    let sessionId = cookieStore.get(CART_COOKIE_NAME)?.value;

    if (!sessionId) {
        sessionId = randomUUID();

        cookieStore.set(CART_COOKIE_NAME, sessionId, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });
    }

    let cart = await prisma.cart.findUnique({
        where: { sessionId },
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { sessionId },
        });
    }

    return {
        cart,
        isGuest: true,
        sessionId,
    };
}

export async function mergeGuestCart(sessionId, userId) {
    if (!sessionId) return;

    const guestCart = await prisma.cart.findUnique({
        where: { sessionId },
        include: { items: true },
    });

    if (!guestCart) return;

    if (guestCart.items.length === 0) {
        await prisma.cart.delete({ where: { id: guestCart.id } });
        return;
    }

    let userCart = await prisma.cart.findUnique({
        where: { userId },
    });

    if (!userCart) {
        userCart = await prisma.cart.create({
            data: { userId },
        });
    }

    for (const item of guestCart.items) {
        const existing = await prisma.cartItem.findFirst({
            where: {
                cartId: userCart.id,
                productId: item.productId,
                variantId: item.variantId,
                colorId: item.colorId,
            },
        });

        if (existing) {
            await prisma.cartItem.update({
                where: { id: existing.id },
                data: {
                    quantity: existing.quantity + item.quantity,
                },
            });
        } else {
            await prisma.cartItem.create({
                data: {
                    cartId: userCart.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    colorId: item.colorId,
                    quantity: item.quantity,
                },
            });
        }
    }

    await prisma.cart.delete({ where: { id: guestCart.id } });
}