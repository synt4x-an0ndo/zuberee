import prisma from "../../../../directory/prisma/prisma.js";
import { resolveCart } from "@/lib/cart.js";
import {
    formatCart,
    CART_INCLUDE,
} from "@/lib/cartFormatter.js";

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const cartItemId = Number(id);

        if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
            return Response.json(
                { success: false, message: "Invalid cart item ID." },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { quantity } = body;

        const qty = Number(quantity);

        if (!Number.isInteger(qty) || qty <= 0) {
            return Response.json(
                { success: false, message: "Quantity must be a positive integer." },
                { status: 400 }
            );
        }

        const { cart } = await resolveCart(request);

        const existingItem = await prisma.cartItem.findFirst({
            where: {
                id: cartItemId,
                cartId: cart.id,
            },
            include: {
                product: {
                    include: {
                        variants: true,
                        inventory: true,
                    },
                },
            },
        });

        if (!existingItem) {
            return Response.json(
                { success: false, message: "Cart item not found." },
                { status: 404 }
            );
        }

        const variant = existingItem.variantId
            ? existingItem.product.variants.find(
                (v) => v.id === existingItem.variantId
            )
            : null;

        const trackInventory =
            existingItem.product.inventory?.trackInventory ?? false;

        const availableStock = variant
            ? variant.stock
            : existingItem.product.stock;

        if (trackInventory && qty > availableStock) {
            return Response.json(
                {
                    success: false,
                    message: `Only ${availableStock} item(s) available in stock.`,
                },
                { status: 400 }
            );
        }

        await prisma.cartItem.update({
            where: { id: cartItemId },
            data: { quantity: qty },
        });

        const fullCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });

        return Response.json({
            success: true,
            message: "Cart item quantity updated.",
            data: formatCart(fullCart),
        });
    } catch (error) {
        console.error("Update cart item API error:", error);

        return Response.json(
            { success: false, message: "Failed to update cart item." },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const cartItemId = Number(id);

        if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
            return Response.json(
                { success: false, message: "Invalid cart item ID." },
                { status: 400 }
            );
        }

        const { cart } = await resolveCart(request);

        const existingItem = await prisma.cartItem.findFirst({
            where: {
                id: cartItemId,
                cartId: cart.id,
            },
        });

        if (!existingItem) {
            return Response.json(
                { success: false, message: "Cart item not found." },
                { status: 404 }
            );
        }

        await prisma.cartItem.delete({ where: { id: cartItemId } });

        const remainingItems = await prisma.cartItem.count({
            where: { cartId: cart.id },
        });

        if (remainingItems === 0) {
            await prisma.cart.delete({ where: { id: cart.id } });
        }

        const fullCart = remainingItems > 0
            ? await prisma.cart.findUnique({
                where: { id: cart.id },
                include: CART_INCLUDE,
            })
            : { id: cart.id, userId: cart.userId, sessionId: cart.sessionId, items: [], createdAt: cart.createdAt, updatedAt: cart.updatedAt };

        return Response.json({
            success: true,
            message: "Item removed from cart.",
            data: formatCart(fullCart),
        });
    } catch (error) {
        console.error("Delete cart item API error:", error);

        return Response.json(
            { success: false, message: "Failed to remove item from cart." },
            { status: 500 }
        );
    }
}