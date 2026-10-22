import { Prisma } from "@prisma/client";

export function inventoryError(message, status = 409) {
    const error = new Error(message);
    error.status = status;
    error.code = "INVENTORY_REJECTED";
    return error;
}

function positiveUniqueIds(ids = []) {
    return [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
        .sort((a, b) => a - b);
}

/**
 * Locks product rows and every variant belonging to those products in a stable
 * order. Every stock mutation goes through this lock before it is calculated.
 */
export async function lockProductFamilies(tx, productIds) {
    const ids = positiveUniqueIds(productIds);
    if (!ids.length) return;

    await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "products" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`
    );
    await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "product_variants" WHERE "productId" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`
    );
}

export async function lockOrder(tx, orderId) {
    const rows = await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${Number(orderId)} FOR UPDATE`
    );
    return rows.length > 0;
}

export async function lockCart(tx, cartId) {
    const rows = await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "carts" WHERE "id" = ${Number(cartId)} FOR UPDATE`
    );
    return rows.length > 0;
}

export async function lockAbandonedCheckout(tx, checkoutId) {
    const rows = await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "abandoned_checkouts" WHERE "id" = ${Number(checkoutId)} FOR UPDATE`
    );
    return rows.length > 0;
}

export function getVariantAvailableStock(variant) {
    return Math.max(
        0,
        Number(variant?.stock || 0) - Math.max(0, Number(variant?.held || 0))
    );
}

/**
 * Variant families expose one derived product stock number for backwards API
 * compatibility. It is never independently decremented for a variant order.
 */
export async function syncVariantProductStock(tx, productIds) {
    const ids = positiveUniqueIds(productIds);
    if (!ids.length) return;

    // In product-level mode Product.stock is authoritative, even when the
    // product still has size choices. Never overwrite it with dormant SKU
    // quantities when another size-based mutation is saved.
    const trackingProducts = await tx.product.findMany({
        where: { id: { in: ids }, inventory: { is: { trackInventory: true } } },
        select: { id: true },
    });
    const trackingIds = trackingProducts.map((product) => product.id);
    if (!trackingIds.length) return;

    const totals = await tx.productVariant.groupBy({
        by: ["productId"],
        where: { productId: { in: trackingIds } },
        _sum: { stock: true },
    });
    const byProduct = new Map(totals.map((row) => [row.productId, row._sum.stock ?? 0]));

    for (const productId of trackingIds) {
        await tx.product.update({
            where: { id: productId },
            data: { stock: byProduct.get(productId) ?? 0 },
        });
    }
}

export async function adjustVariantStock(tx, {
    variantId,
    delta,
    type,
    note = null,
    userId = null,
    orderId = null,
}) {
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) {
        throw inventoryError("A non-zero whole-number variant stock adjustment is required.", 400);
    }

    const variant = await tx.productVariant.findUnique({
        where: { id: Number(variantId) },
        select: { id: true, productId: true, stock: true, held: true, reserved: true, value: true },
    });
    if (!variant) throw inventoryError("Variant not found.", 404);

    const nextStock = variant.stock + amount;
    if (nextStock < 0) {
        throw inventoryError(`Not enough stock for variant ${variant.value}.`);
    }
    if (nextStock < variant.held) {
        throw inventoryError(`Stock for variant ${variant.value} cannot be lower than its held quantity.`);
    }

    const updatedVariant = await tx.productVariant.update({
        where: { id: variant.id },
        data: {
            stock: nextStock,
            // `reserved` is retained for API compatibility and mirrors held.
            reserved: variant.held,
        },
        select: { id: true, productId: true, stock: true, held: true },
    });

    await tx.stockMovement.create({
        data: {
            productVariantId: updatedVariant.id,
            type,
            quantity: amount,
            stockAfter: updatedVariant.stock,
            reservedAfter: updatedVariant.held,
            note,
            userId,
            orderId,
        },
    });

    return updatedVariant;
}

export async function adjustProductStock(tx, {
    productId,
    delta,
    type,
    note = null,
    userId = null,
    orderId = null,
}) {
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) {
        throw inventoryError("A non-zero whole-number product stock adjustment is required.", 400);
    }

    const product = await tx.product.findUnique({
        where: { id: Number(productId) },
        select: {
            id: true,
            name: true,
            stock: true,
            inventory: { select: { trackInventory: true } },
            _count: { select: { variants: true } },
        },
    });
    if (!product) throw inventoryError("Product not found.", 404);
    if (product._count.variants > 0 && product.inventory?.trackInventory) {
        throw inventoryError(`Select a variant for ${product.name}; per-size stock is enabled.`, 400);
    }

    const nextStock = product.stock + amount;
    if (nextStock < 0) throw inventoryError(`Not enough stock for ${product.name}.`);

    const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stock: nextStock },
        select: { id: true, stock: true },
    });

    await tx.productStockMovement.create({
        data: {
            productId: updatedProduct.id,
            type,
            quantity: amount,
            stockAfter: updatedProduct.stock,
            note,
            userId,
            orderId,
        },
    });

    return updatedProduct;
}

export function isTransactionConflict(error) {
    return error?.code === "P2034" || error?.code === "P2028";
}
