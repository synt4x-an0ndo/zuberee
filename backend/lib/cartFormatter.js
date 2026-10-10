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

    return {
        id: item.id,
        product_id: product.id,
        title: product.name,
        sku: product.sku,

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