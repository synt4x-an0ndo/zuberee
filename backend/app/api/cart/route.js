import prisma from "@/directory/prisma/prisma.js";
import { resolveCart } from "@/lib/cart.js";
import { buildCartSnapshot, syncAbandonedCheckout } from "@/lib/abandonedCheckout.js";
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

export async function GET(request) {
    try {
        const { cart } = await resolveCart(request);

        const fullCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });

        return Response.json({
            success: true,
            message: "Cart loaded.",
            data: formatCart(fullCart),
        });
    } catch (error) {
        console.error("Get cart API error:", error);

        return Response.json(
            { success: false, message: "Failed to load cart." },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        const {
            productId,
            product_id,
            variantId,
            variant_id,
            colorId,
            color_id,
            quantity = 1,
        } = body;

        const finalProductId = Number(productId ?? product_id);
        const finalVariantId =
            variantId ?? variant_id ?? null;
        const finalColorId =
            colorId ?? color_id ?? null;
        const finalQuantity = Number(quantity);

        if (!Number.isInteger(finalProductId) || finalProductId <= 0) {
            return Response.json(
                { success: false, message: "Valid productId is required." },
                { status: 400 }
            );
        }

        if (!Number.isInteger(finalQuantity) || finalQuantity < 1) {
            return Response.json(
                { success: false, message: "Quantity must be at least 1." },
                { status: 400 }
            );
        }

        const product = await prisma.product.findUnique({
            where: { id: finalProductId },
            include: { variants: true, inventory: true },
        });

        if (!product) {
            return Response.json(
                { success: false, message: "Product not found." },
                { status: 404 }
            );
        }

        if (!product.isActive || isProductUnavailable(product)) {
            return Response.json(
                { success: false, message: "Product is not available." },
                { status: 400 }
            );
        }

        let resolvedVariantId = null;
        let selectedVariant = null;

        if (finalVariantId !== null) {
            selectedVariant = product.variants.find(
                (v) => v.id === Number(finalVariantId)
            );

            if (!selectedVariant) {
                return Response.json(
                    {
                        success: false,
                        message: "Variant not found for this product.",
                    },
                    { status: 404 }
                );
            }
            if (!selectedVariant.isActive) {
                return Response.json(
                    { success: false, message: "This variant is not available." },
                    { status: 400 }
                );
            }

            resolvedVariantId = selectedVariant.id;
        } else if (product.variants.length > 0) {
            return Response.json(
                { success: false, message: "Please select a product variant." },
                { status: 400 }
            );
        }

        const { cart, userId, sessionId } = await resolveCart(request);

        // The same product/variant can appear on more than one cart line
        // (for example with different colours), so capacity is checked
        // against the cart total rather than only this add request.
        const usesVariantStock = Boolean(selectedVariant && tracksStockPerSize(product));
        const sameLineItems = await prisma.cartItem.findMany({
            where: {
                cartId: cart.id,
                productId: finalProductId,
                ...(usesVariantStock ? { variantId: resolvedVariantId } : {}),
            },
            select: { quantity: true },
        });
        const existingQuantity = sameLineItems.reduce(
            (sum, item) => sum + item.quantity,
            0
        );
        const capacity = usesVariantStock
            ? getVariantOrderCapacity(product, selectedVariant)
            : getProductOrderCapacity(product);
        const preorderEligible = usesVariantStock
            ? isPreorderEligible(product, selectedVariant)
            : isPreorderEligible(product);

        if (capacity !== null && existingQuantity + finalQuantity > capacity) {
            return Response.json(
                {
                    success: false,
                    message: usesVariantStock
                        ? preorderEligible
                            ? `Only ${capacity} item(s) can be ordered for this variant, including pre-order.`
                            : "Not enough stock for this variant."
                        : preorderEligible
                            ? `Only ${capacity} item(s) can be ordered, including pre-order.`
                            : "Not enough stock.",
                },
                { status: 400 }
            );
        }

        let resolvedColorId = null;

        if (finalColorId !== null) {
            const color = await prisma.productColor.findFirst({
                where: {
                    id: Number(finalColorId),
                    productId: finalProductId,
                },
            });

            if (!color) {
                return Response.json(
                    {
                        success: false,
                        message: "Color not found for this product.",
                    },
                    { status: 404 }
                );
            }

            resolvedColorId = color.id;
        }

        const existing = await prisma.cartItem.findFirst({
            where: {
                cartId: cart.id,
                productId: finalProductId,
                variantId: resolvedVariantId,
                colorId: resolvedColorId,
            },
        });

        if (existing) {
            await prisma.cartItem.update({
                where: { id: existing.id },
                data: {
                    quantity: existing.quantity + finalQuantity,
                },
            });
        } else {
            await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId: finalProductId,
                    variantId: resolvedVariantId,
                    colorId: resolvedColorId,
                    quantity: finalQuantity,
                },
            });
        }

        // Track the cart as a possible abandonment from the very first add.
        // No contact details are stored here - only what the cart contains -
        // and nothing is ever invented. Never throws, so it cannot break the add.
        await syncAbandonedCheckout({
            sessionId: sessionId ?? null,
            userId: userId ?? null,
            data: { cartItems: await buildCartSnapshot(cart.id) },
        });

        const fullCart = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });

        return Response.json(
            {
                success: true,
                message: "Item added to cart.",
                data: formatCart(fullCart),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Add to cart API error:", error);

        return Response.json(
            { success: false, message: "Failed to add item to cart." },
            { status: 500 }
        );
    }
}

export async function DELETE(request) {
    try {
        const { cart } = await resolveCart(request);

        await prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
        });

        return Response.json({
            success: true,
            message: "Cart cleared.",
        });
    } catch (error) {
        console.error("Clear cart API error:", error);

        return Response.json(
            { success: false, message: "Failed to clear cart." },
            { status: 500 }
        );
    }
}