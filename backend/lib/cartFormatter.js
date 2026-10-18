import {
    getPreorderRemaining,
    getProductOrderCapacity,
    getVariantOrderCapacity,
    isPreorderEligible,
    isProductPreorder,
} from "@/lib/preorder.js";

export const CART_INCLUDE = {
    items: {
        orderBy: { createdAt: "desc" },
        include: {
            product: {
                include: {
                    images: { orderBy: { isPrimary: "desc" } },
                    variants: true,
                    colors: true,
                },
            },
        },
    },
};

export function formatCartItem(item) {
    const product = item.product;

    const variant = product.variants?.find(
        (v) => v.id === item.variantId
    );

    const basePrice = Number(product.price);

    const effectivePrice = variant?.price
        ? Number(variant.price)
        : product.discount !== null
            ? Number(product.discount)
            : basePrice;

    const orderCapacity = variant
        ? getVariantOrderCapacity(product, variant)
        : getProductOrderCapacity(product);
    const physicalStock = variant ? variant.stock : product.stock;
    const isPreorder = isProductPreorder(product)
        || (isPreorderEligible(product, variant) && item.quantity > Math.max(0, physicalStock));

    return {
        id: item.id,
        product_id: product.id,
        title: product.name,
        sku: product.sku,
        product_status: product.status?.toLowerCase().replaceAll("_", "-") ?? null,
        is_preorder: isPreorder,
        order_capacity: orderCapacity,
        max_quantity: orderCapacity,

        image:
            product.images?.find((img) => img.isPrimary)?.imageUrl ??
            product.images?.[0]?.imageUrl ??
            null,

        variant: variant
            ? {
                id: variant.id,
                name: variant.name,
                value: variant.value,
                stock: variant.stock,
                allow_preorder: isPreorderEligible(product, variant),
                preorder_limit: variant.preorderLimit,
                preorder_count: variant.preorderCount,
                preorder_available: getPreorderRemaining(variant),
                order_capacity: orderCapacity,
                max_quantity: orderCapacity,
            }
            : null,

        color: item.colorId
            ? product.colors?.find((c) => c.id === item.colorId) ?? null
            : null,

        unit_price: effectivePrice,
        quantity: item.quantity,
        subtotal: effectivePrice * item.quantity,
    };
}

export function formatCart(cart) {
    const items = (cart.items ?? []).map(formatCartItem);

    const subtotal = items.reduce(
        (sum, item) => sum + item.subtotal,
        0
    );

    return {
        id: cart.id,
        user_id: cart.userId,
        session_id: cart.sessionId,
        items,
        total_items: items.reduce(
            (sum, i) => sum + i.quantity,
            0
        ),
        subtotal,
        created_at: cart.createdAt,
        updated_at: cart.updatedAt,
    };
}