import prisma from "@/directory/prisma/prisma.js";
import { resolveCart } from "@/lib/cart.js";
import {
    formatCart,
    CART_INCLUDE,
} from "@/lib/cartFormatter.js";
import {
    getProductOrderCapacity,
    getVariantOrderCapacity,
    isPreorderEligible,
    isProductUnavailable,
    tracksStockPerSize,
} from "@/lib/preorder.js";

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

        if (isProductUnavailable(existingItem.product)) {
            return Response.json(
                { success: false, message: "Product is not available." },
                { status: 400 }
            );
        }
        if (existingItem.variantId && (!variant || !variant.isActive)) {
            return Response.json(
                { success: false, message: "This variant is not available." },
                { status: 400 }
            );
        }
        if (!existingItem.variantId && existingItem.product.variants.length > 0) {
            return Response.json(
                { success: false, message: "Please select a product variant." },
                { status: 400 }
            );
        }

        const usesVariantStock = Boolean(variant && tracksStockPerSize(existingItem.product));
        const capacity = usesVariantStock
            ? getVariantOrderCapacity(existingItem.product, variant)
            : getProductOrderCapacity(existingItem.product);
        const preorderEligible = usesVariantStock
            ? isPreorderEligible(existingItem.product, variant)
            : isPreorderEligible(existingItem.product);

        if (capacity !== null) {
            const otherItems = await prisma.cartItem.findMany({
                where: {
                    cartId: cart.id,
                    productId: existingItem.productId,
                    ...(usesVariantStock ? { variantId: existingItem.variantId } : {}),
                    NOT: { id: cartItemId },
                },
                select: { quantity: true },
            });
            const otherQuantity = otherItems.reduce(
                (sum, item) => sum + item.quantity,
                0
            );

            if (otherQuantity + qty > capacity) {
                return Response.json(
                    {
                        success: false,
                        message: preorderEligible
                            ? `Only ${capacity} item(s) can be ordered, including pre-order.`
                            : `Only ${capacity} item(s) available in stock.`,
                    },
                    { status: 400 }
                );
            }
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