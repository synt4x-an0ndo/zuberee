const UNAVAILABLE_STATUSES = new Set(["OUT_OF_STOCK", "SOLD_OUT"]);

export function preorderError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    error.code = "PREORDER_CAPACITY_REJECTED";
    return error;
}

export function isProductUnavailable(product) {
    return !product || product.isActive === false || UNAVAILABLE_STATUSES.has(product.status);
}

export function isProductPreorder(product) {
    return product?.status === "PRE_ORDER";
}

export function isPreorderEligible(product, variant = null) {
    if (!product || UNAVAILABLE_STATUSES.has(product.status)) return false;
    return isProductPreorder(product) || Boolean(variant?.allowPreorder);
}

export function getPreorderRemaining(variant) {
    if (!variant || variant.preorderLimit === null || variant.preorderLimit === undefined) return null;
    return Math.max(0, Number(variant.preorderLimit) - Number(variant.preorderCount || 0));
}

export function getVariantOrderCapacity(product, variant) {
    if (!variant || isProductUnavailable(product)) return 0;
    const stock = Math.max(0, Number(variant.stock || 0));
    if (!isPreorderEligible(product, variant)) return stock;
    const remaining = getPreorderRemaining(variant);
    return remaining === null ? null : stock + remaining;
}

export function getProductOrderCapacity(product) {
    if (isProductUnavailable(product)) return 0;
    if (isProductPreorder(product)) return null;
    return Math.max(0, Number(product?.stock || 0));
}

export function allocateQuantity({ quantity, stock, eligible, preorderRemaining = null }) {
    const qty = Number(quantity);
    const availableStock = Math.max(0, Number(stock || 0));
    const stockQuantity = Math.min(qty, availableStock);
    const preorderQuantity = qty - stockQuantity;

    if (preorderQuantity > 0 && !eligible) return null;
    if (preorderQuantity > 0 && preorderRemaining !== null && preorderQuantity > preorderRemaining) return null;

    return { stockQuantity, preorderQuantity };
}

/**
 * Allocates a set of normalized order entries against one inventory
 * snapshot. Duplicate product/variant lines consume the same mirrored
 * stock and pre-order capacity in request order.
 *
 * Each entry must contain product, variant (or null), and quantity. The
 * returned entries gain stockQuantity, preorderQuantity, and isPreorder.
 */
export function allocateOrderEntries(entries) {
    const variantState = new Map();
    const productState = new Map();

    for (const entry of entries) {
        const { product, variant, quantity } = entry;

        if (isProductUnavailable(product)) {
            throw preorderError(`Product ${product?.name || entry.productId} is not available.`, 400);
        }

        let allocation;

        if (variant) {
            if (!variantState.has(variant.id)) {
                variantState.set(variant.id, {
                    stock: Number(variant.stock || 0),
                    preorderCount: Number(variant.preorderCount || 0),
                });
            }
            const state = variantState.get(variant.id);
            const preorderRemaining = variant.preorderLimit === null || variant.preorderLimit === undefined
                ? null
                : Math.max(0, Number(variant.preorderLimit) - state.preorderCount);

            allocation = allocateQuantity({
                quantity,
                stock: state.stock,
                eligible: isPreorderEligible(product, variant),
                preorderRemaining,
            });

            if (!allocation) {
                const capacity = getVariantOrderCapacity(
                    product,
                    { ...variant, stock: state.stock, preorderCount: state.preorderCount }
                );
                throw preorderError(
                    isPreorderEligible(product, variant) && capacity !== null
                        ? `Only ${capacity} item(s) can be ordered for variant ${variant.value}, including pre-order.`
                        : `Not enough stock for variant ${variant.value}.`
                );
            }

            state.stock -= allocation.stockQuantity;
            state.preorderCount += allocation.preorderQuantity;
        } else {
            if (!productState.has(product.id)) {
                productState.set(product.id, { stock: Number(product.stock || 0) });
            }
            const state = productState.get(product.id);
            allocation = allocateQuantity({
                quantity,
                stock: state.stock,
                eligible: isProductPreorder(product),
                preorderRemaining: null,
            });

            if (!allocation) {
                throw preorderError(`Not enough stock for ${product.name}.`);
            }

            state.stock -= allocation.stockQuantity;
        }

        entry.stockQuantity = allocation.stockQuantity;
        entry.preorderQuantity = allocation.preorderQuantity;
        entry.isPreorder = isProductPreorder(product) || allocation.preorderQuantity > 0;
    }

    return entries;
}

export function getItemPreorderQuantity(item) {
    const quantity = Math.max(0, Number(item?.quantity || 0));
    return Math.min(quantity, Math.max(0, Number(item?.preorderQuantity || 0)));
}

export function getItemStockQuantity(item) {
    return Math.max(0, Number(item?.quantity || 0) - getItemPreorderQuantity(item));
}
