import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { isValidBdPhone, isValidEmail, normalizeBdPhone, normalizeEmail } from "@/lib/contactValidation.js";
import { getItemPreorderQuantity, getItemStockQuantity, getPreorderRemaining, isPreorderEligible, isProductPreorder } from "@/lib/preorder.js";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, sku: true, images: { orderBy: { isPrimary: "desc" }, take: 1, select: { imageUrl: true } } },
            },
            variant: {
                select: { id: true, name: true, value: true },
            },
        },
    },
    user: { select: { id: true, name: true, phone: true, email: true } },
};

function formatOrderItem(item) {
    const firstImage = item.product?.images?.[0]?.imageUrl ?? null;
    return {
        id: item.id,
        order_id: item.orderId,
        product_id: item.productId,
        product_variant_id: item.variantId ?? null,
        title: item.product?.name ?? null,
        sku: item.product?.sku ?? null,
        unitPrice: Number(item.unitPrice),
        qty: item.quantity,
        is_preorder: Boolean(item.isPreorder || item.preorderQuantity > 0),
        preorder_quantity: item.preorderQuantity || 0,
        inventory_state: item.preorderQuantity > 0 ? "preorder" : "committed",
        totalPrice: Number(item.unitPrice) * item.quantity,
        colorImage: firstImage,
        color_name: "",
        size: item.size || item.variant?.value || null,
        variant: item.variant ? item.variant.value || item.variant.name || null : null,
        created_at: item.createdAt,
    };
}

function formatOrder(order) {
    const subtotal = Number(order.totalAmount) - Number(order.shippingFee);
    return {
        id: order.id,
        order_number: `ORD-${String(order.id).padStart(5, "0")}`,
        user_id: order.userId,
        name: order.contactName || (order.user ? order.user.name : order.guestName),
        phone: order.contactPhone || (order.user ? order.user.phone : order.guestPhone),
        email: order.contactEmail || order.user?.email || null,
        address: order.shippingAddress,
        district: order.district,
        shipping_cost: Number(order.shippingFee),
        subtotal,
        total: Number(order.totalAmount),
        advance_payment: Number(order.advancePayment),
        payment_method: order.paymentMethod,
        delivery_notes: order.deliveryNotes || "",
        courier_entry: order.courierEntry || "",
        status: order.status.toLowerCase(),
        payment_status: order.paymentStatus.toLowerCase(),
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        customer_type: order.userId ? "Repeat Customer" : "New",
        order_items: order.items.map(formatOrderItem),
    };
}


/**
 * Stock restore/re-deduct: new order lines record their variantId, while
 * the stock_movements ledger remains the fallback for legacy lines that do
 * not. The ledger is the source of truth for which variants an older order
 * deducted. Sale quantities are negative, releases are
 * positive, so per variant:
 *   netQty      = sum(quantity) over sale+release rows for this order
 *   originalQty = the largest deducted amount ever observed while replaying
 *                 those rows in order (the order's original variant qty)
 * Currently-deducted units = -netQty when netQty < 0. Reactivation must
 * re-deduct originalQty (not the sum of all historical releases, which
 * would over-deduct on the second and later reactivations).
 * Product-level stock (products.stock, also decremented at order creation)
 * is restored/re-deducted from the order items. Orders created before sale
 * logging and OrderItem.variantId existed may have no usable variant split,
 * so only their product stock can be restored in that case.
 */
async function getLedgerTotals(tx, orderId) {
    const rows = await tx.stockMovement.findMany({
        where: { orderId, type: { in: ["sale", "release"] } },
        select: { productVariantId: true, type: true, quantity: true },
        orderBy: { id: "asc" },
    });
    const totals = new Map();
    for (const row of rows) {
        const entry = totals.get(row.productVariantId) || { netQty: 0, originalQty: 0 };
        entry.netQty += row.quantity;
        entry.originalQty = Math.max(entry.originalQty, -entry.netQty, 0);
        totals.set(row.productVariantId, entry);
    }
    return totals;
}

function getVariantStockQuantities(items) {
    const quantities = new Map();
    for (const item of items) {
        if (!item.variantId) continue;
        quantities.set(item.variantId, (quantities.get(item.variantId) || 0) + getItemStockQuantity(item));
    }
    return quantities;
}

function getVariantPreorderQuantities(items) {
    const quantities = new Map();
    for (const item of items) {
        if (!item.variantId) continue;
        const quantity = getItemPreorderQuantity(item);
        if (quantity > 0) quantities.set(item.variantId, (quantities.get(item.variantId) || 0) + quantity);
    }
    return quantities;
}

function getProductStockQuantities(items) {
    const quantities = new Map();
    for (const item of items) {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + getItemStockQuantity(item));
    }
    return quantities;
}

async function adjustVariantPreorderCount(tx, variantId, delta) {
    if (!delta) return;
    if (delta > 0) {
        await tx.productVariant.update({
            where: { id: variantId },
            data: { preorderCount: { increment: delta } },
        });
        return;
    }
    const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { preorderCount: true },
    });
    if (!variant) return;
    await tx.productVariant.update({
        where: { id: variantId },
        data: { preorderCount: Math.max(0, variant.preorderCount + delta) },
    });
}

async function restoreOrderStock(tx, order, userId, note) {
    const totals = await getLedgerTotals(tx, order.id);
    for (const [productVariantId, total] of totals) {
        const restoreQty = total.netQty < 0 ? -total.netQty : 0;
        if (restoreQty <= 0) continue;
        const updatedVariant = await tx.productVariant.update({
            where: { id: productVariantId },
            data: { stock: { increment: restoreQty } },
        });
        await tx.stockMovement.create({
            data: {
                productVariantId,
                type: "release",
                quantity: restoreQty,
                stockAfter: updatedVariant.stock,
                reservedAfter: updatedVariant.held,
                orderId: order.id,
                note,
                userId,
            },
        });
    }
    for (const [variantId, quantity] of getVariantPreorderQuantities(order.items)) {
        await adjustVariantPreorderCount(tx, variantId, -quantity);
    }
    for (const [productId, quantity] of getProductStockQuantities(order.items)) {
        if (quantity <= 0) continue;
        await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: quantity } },
        });
    }
}

async function redeductOrderStock(tx, order, userId) {
    const insufficient = (label) => {
        const error = new Error(`Not enough stock to reactivate this order (${label}).`);
        error.code = "INSUFFICIENT_STOCK";
        return error;
    };
    const totals = await getLedgerTotals(tx, order.id);
    const desiredVariantQuantities = getVariantStockQuantities(order.items);
    const ledgerVariantRows = totals.size
        ? await tx.productVariant.findMany({
            where: { id: { in: [...totals.keys()] } },
            select: { id: true, productId: true },
        })
        : [];
    const ledgerVariantProduct = new Map(ledgerVariantRows.map((row) => [row.id, row.productId]));
    const ledgerVariantsByProduct = new Map();
    for (const row of ledgerVariantRows) {
        const list = ledgerVariantsByProduct.get(row.productId) || [];
        list.push(row.id);
        ledgerVariantsByProduct.set(row.productId, list);
    }
    const legacyItemsByProduct = new Map();
    const explicitVariantProductIds = new Set();
    for (const item of order.items) {
        if (item.variantId) explicitVariantProductIds.add(item.productId);
        else {
            const list = legacyItemsByProduct.get(item.productId) || [];
            list.push(item);
            legacyItemsByProduct.set(item.productId, list);
        }
    }

    for (const [productVariantId, total] of totals) {
        const currentlyDeductedQty = total.netQty < 0 ? -total.netQty : 0;
        let desiredQty;
        if (desiredVariantQuantities.has(productVariantId)) {
            desiredQty = desiredVariantQuantities.get(productVariantId);
        } else {
            const productId = ledgerVariantProduct.get(productVariantId);
            const legacyItems = legacyItemsByProduct.get(productId) || [];
            const ledgerVariants = ledgerVariantsByProduct.get(productId) || [];
            if (legacyItems.length === 1 && ledgerVariants.length === 1) {
                desiredQty = getItemStockQuantity(legacyItems[0]);
            } else if (productId && explicitVariantProductIds.has(productId)) {
                desiredQty = 0;
            } else {
                desiredQty = total.originalQty;
            }
        }
        const deductQty = desiredQty - currentlyDeductedQty;
        if (deductQty <= 0) continue;
        const variant = await tx.productVariant.findUnique({
            where: { id: productVariantId },
            select: { stock: true, value: true },
        });
        if (!variant) continue;
        if (variant.stock < deductQty) throw insufficient(`variant ${variant.value}`);
        const updatedVariant = await tx.productVariant.update({
            where: { id: productVariantId },
            data: { stock: { decrement: deductQty } },
        });
        await tx.stockMovement.create({
            data: {
                productVariantId,
                type: "sale",
                quantity: -deductQty,
                stockAfter: updatedVariant.stock,
                reservedAfter: updatedVariant.held,
                orderId: order.id,
                note: "Order reactivated",
                userId,
            },
        });
    }
    for (const [variantId, quantity] of getVariantPreorderQuantities(order.items)) {
        const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: {
                value: true,
                allowPreorder: true,
                preorderLimit: true,
                preorderCount: true,
                product: { select: { status: true, isActive: true } },
            },
        });
        if (!variant) continue;
        const remaining = getPreorderRemaining(variant);
        if (!isPreorderEligible(variant.product, variant) || (remaining !== null && quantity > remaining)) {
            throw insufficient(`pre-order capacity for variant ${variant.value}`);
        }
        await adjustVariantPreorderCount(tx, variantId, quantity);
    }

    // products.stock is a legacy denormalised counter (it is 0/negative
    // for several products whose real stock lives on variants), so
    // availability is enforced on variant stock above. Only the physical
    // portion of a pre-order line is mirrored here; pre-order units do
    // not decrement it until received stock is allocated at shipment.
    for (const [productId, quantity] of getProductStockQuantities(order.items)) {
        if (quantity <= 0) continue;
        await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: quantity } },
        });
    }
}


function orderUpdateError(status, message) {
    const error = new Error(message);
    error.status = status;
    error.code = "ORDER_UPDATE_REJECTED";
    return error;
}

function parseNonNegativeMoney(value, label) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw orderUpdateError(400, `${label} must be 0 or more.`);
    }
    return Math.round(amount * 100) / 100;
}

async function allocatePreorderStock(tx, orderId, userId) {
    const items = await tx.orderItem.findMany({
        where: { orderId, preorderQuantity: { gt: 0 } },
    });
    if (items.length === 0) return;

    const variantQuantities = getVariantPreorderQuantities(items);
    const productQuantities = new Map();
    const productOnlyQuantities = new Map();
    for (const item of items) {
        const quantity = getItemPreorderQuantity(item);
        productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + quantity);
        if (!item.variantId) {
            productOnlyQuantities.set(item.productId, (productOnlyQuantities.get(item.productId) || 0) + quantity);
        }
    }

    const variantRows = new Map();
    for (const [variantId, quantity] of variantQuantities) {
        const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: { stock: true, held: true, value: true },
        });
        if (!variant) continue;
        if (variant.stock < quantity) {
            throw orderUpdateError(409, `Receive enough stock for variant ${variant.value} before shipping or delivering this pre-order.`);
        }
        variantRows.set(variantId, variant);
    }

    for (const [productId, quantity] of productOnlyQuantities) {
        const product = await tx.product.findUnique({
            where: { id: productId },
            select: { name: true, stock: true },
        });
        // A line without a variant is allocated from products.stock,
        // the same counter used when that line was placed, even if the
        // product also has size variants for other lines.
        if (product && product.stock < quantity) {
            throw orderUpdateError(409, `Receive enough stock for ${product.name} before shipping or delivering this pre-order.`);
        }
    }

    for (const [variantId, quantity] of variantQuantities) {
        if (!variantRows.has(variantId)) continue;
        const updatedVariant = await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { decrement: quantity } },
        });
        await tx.stockMovement.create({
            data: {
                productVariantId: variantId,
                type: "sale",
                quantity: -quantity,
                stockAfter: updatedVariant.stock,
                reservedAfter: updatedVariant.held,
                orderId,
                note: "Pre-order fulfilled from received stock",
                userId,
            },
        });
        await adjustVariantPreorderCount(tx, variantId, -quantity);
    }

    for (const [productId, quantity] of productQuantities) {
        await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: quantity } },
        });
    }

    await tx.orderItem.updateMany({
        where: { orderId, preorderQuantity: { gt: 0 } },
        data: { preorderQuantity: 0 },
    });
}

function buildDesiredItems(rawItems, existingOrder, productMap) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw orderUpdateError(400, "An order needs at least one item.");
    }

    const existingById = new Map(existingOrder.items.map((item) => [item.id, item]));
    const seenIds = new Set();

    return rawItems.map((raw) => {
        if (!raw || typeof raw !== "object") throw orderUpdateError(400, "Invalid order item.");

        const rawId = raw.id ?? null;
        const id = rawId === null || rawId === "" ? null : Number(rawId);
        if (id !== null && (!Number.isInteger(id) || id <= 0)) throw orderUpdateError(400, "Invalid order item ID.");
        if (id !== null && seenIds.has(id)) throw orderUpdateError(400, "The same order item was sent more than once.");
        if (id !== null) seenIds.add(id);

        const existingItem = id ? existingById.get(id) : null;
        if (id && !existingItem) throw orderUpdateError(400, "An item does not belong to this order.");

        const productId = Number(raw.product_id ?? raw.productId ?? existingItem?.productId);
        if (!Number.isInteger(productId) || productId <= 0) throw orderUpdateError(400, "Every item needs a product.");
        if (existingItem && productId !== existingItem.productId) {
            throw orderUpdateError(400, "To change a product, remove the old item and add the new product.");
        }

        const product = productMap.get(productId);
        if (!product || (!product.isActive && !existingItem)) throw orderUpdateError(404, `Product ${productId} not available.`);

        const quantity = Number(raw.qty ?? raw.quantity ?? existingItem?.quantity ?? 1);
        if (!Number.isInteger(quantity) || quantity < 1) throw orderUpdateError(400, "Every item quantity must be at least 1.");

        const unitPrice = parseNonNegativeMoney(raw.unitPrice ?? raw.unit_price ?? existingItem?.unitPrice ?? 0, "Item price");

        const rawVariantId = raw.variantId ?? raw.variant_id ?? raw.product_variant_id ?? null;
        let variantId = existingItem?.variantId ?? null;
        let variant = null;
        if (rawVariantId !== null && rawVariantId !== "") {
            variantId = Number(rawVariantId);
            if (!Number.isInteger(variantId) || variantId <= 0) throw orderUpdateError(400, "Invalid product variant.");
            variant = (product.variants || []).find((entry) => entry.id === variantId) || null;
            if (!variant) throw orderUpdateError(404, `Variant ${variantId} not found for ${product.name}.`);
        } else if (variantId) {
            variant = (product.variants || []).find((entry) => entry.id === variantId) || null;
        }

        let size;
        if (raw.size !== undefined) size = raw.size === null ? null : String(raw.size).trim() || null;
        else if (raw.selected_size !== undefined) size = raw.selected_size === null ? null : String(raw.selected_size).trim() || null;
        else size = existingItem?.size || variant?.value || null;
        if (size && size.length > 100) throw orderUpdateError(400, "Item size is too long.");

        return {
            id,
            productId,
            variantId: variantId || null,
            size,
            quantity,
            unitPrice,
            isPreorder: Boolean(existingItem?.isPreorder || getItemPreorderQuantity(existingItem || {}) > 0),
            preorderQuantity: existingItem ? getItemPreorderQuantity(existingItem) : 0,
        };
    });
}

function itemsCompositionChanged(existingItems, desiredItems) {
    if (existingItems.length !== desiredItems.length) return true;
    const existingById = new Map(existingItems.map((item) => [item.id, item]));
    return desiredItems.some((item) => {
        if (!item.id) return true;
        const existing = existingById.get(item.id);
        return !existing || existing.productId !== item.productId || existing.quantity !== item.quantity || (existing.variantId || null) !== (item.variantId || null);
    });
}

async function resolveLegacyVariantIds(tx, existingOrder, desiredItems) {
    const totals = await getLedgerTotals(tx, existingOrder.id);
    if (totals.size === 0) return { desiredItems, existingVariantByItemId: new Map() };

    const variantRows = await tx.productVariant.findMany({
        where: { id: { in: [...totals.keys()] } },
        select: { id: true, productId: true },
    });
    const deductedByProduct = new Map();
    for (const row of variantRows) {
        const total = totals.get(row.id);
        if (!total || total.netQty >= 0) continue;
        const list = deductedByProduct.get(row.productId) || [];
        list.push({ variantId: row.id, quantity: -total.netQty });
        deductedByProduct.set(row.productId, list);
    }

    const legacyByProduct = new Map();
    for (const item of existingOrder.items) {
        if (item.variantId) continue;
        const list = legacyByProduct.get(item.productId) || [];
        list.push(item);
        legacyByProduct.set(item.productId, list);
    }

    const desiredById = new Map(desiredItems.filter((item) => item.id).map((item) => [item.id, item]));
    const existingVariantByItemId = new Map();

    for (const item of existingOrder.items) {
        if (item.variantId) {
            existingVariantByItemId.set(item.id, item.variantId);
            continue;
        }
        const candidates = deductedByProduct.get(item.productId) || [];
        const rows = legacyByProduct.get(item.productId) || [];
        if (candidates.length === 1 && rows.length === 1 && candidates[0].quantity === getItemStockQuantity(item)) {
            existingVariantByItemId.set(item.id, candidates[0].variantId);
            continue;
        }
        if (candidates.length > 0) {
            const desired = desiredById.get(item.id);
            if (!desired || desired.quantity !== item.quantity || desired.productId !== item.productId) {
                throw orderUpdateError(409, "This older order item does not record which size/variant was deducted, so its quantity cannot be changed safely.");
            }
        }
        existingVariantByItemId.set(item.id, null);
    }

    return {
        existingVariantByItemId,
        desiredItems: desiredItems.map((item) => (
            item.id && !item.variantId
                ? { ...item, variantId: existingVariantByItemId.get(item.id) || null }
                : item
        )),
    };
}

async function applyItemStockDeltas(tx, existingOrder, desiredItems, existingVariantByItemId, userId) {
    const variantGroups = new Map();
    const productOnlyGroups = new Map();

    const getVariantGroup = (variantId) => {
        if (!variantGroups.has(variantId)) {
            variantGroups.set(variantId, {
                existingQuantity: 0,
                existingStockQuantity: 0,
                existingPreorderQuantity: 0,
                desiredQuantity: 0,
                items: [],
            });
        }
        return variantGroups.get(variantId);
    };
    const getProductOnlyGroup = (productId) => {
        if (!productOnlyGroups.has(productId)) {
            productOnlyGroups.set(productId, {
                existingQuantity: 0,
                existingStockQuantity: 0,
                existingPreorderQuantity: 0,
                desiredQuantity: 0,
                items: [],
            });
        }
        return productOnlyGroups.get(productId);
    };

    for (const item of existingOrder.items) {
        const variantId = existingVariantByItemId.get(item.id) || item.variantId || null;
        const group = variantId ? getVariantGroup(variantId) : getProductOnlyGroup(item.productId);
        group.existingQuantity += item.quantity;
        group.existingStockQuantity += getItemStockQuantity(item);
        group.existingPreorderQuantity += getItemPreorderQuantity(item);
    }

    for (const item of desiredItems) {
        const group = item.variantId ? getVariantGroup(item.variantId) : getProductOnlyGroup(item.productId);
        group.desiredQuantity += item.quantity;
        group.items.push(item);
    }

    const assignGroupAllocation = (group, desiredStockQuantity, product) => {
        let stockRemaining = desiredStockQuantity;
        for (const item of group.items) {
            const stockQuantity = Math.min(item.quantity, Math.max(0, stockRemaining));
            stockRemaining -= stockQuantity;
            item.preorderQuantity = item.quantity - stockQuantity;
            item.isPreorder = Boolean(
                (item.id && item.isPreorder)
                || isProductPreorder(product)
                || item.preorderQuantity > 0
            );
        }
    };

    for (const [variantId, group] of variantGroups) {
        const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: {
                stock: true,
                held: true,
                value: true,
                allowPreorder: true,
                preorderLimit: true,
                preorderCount: true,
                product: { select: { status: true, isActive: true, name: true } },
            },
        });
        if (!variant) continue;

        let desiredStockQuantity;
        let desiredPreorderQuantity;
        if (group.desiredQuantity <= group.existingStockQuantity) {
            desiredStockQuantity = group.desiredQuantity;
            desiredPreorderQuantity = 0;
        } else if (group.desiredQuantity <= group.existingQuantity) {
            desiredStockQuantity = group.existingStockQuantity;
            desiredPreorderQuantity = group.desiredQuantity - desiredStockQuantity;
        } else {
            if (variant.product.status === "OUT_OF_STOCK" || variant.product.status === "SOLD_OUT") {
                throw orderUpdateError(400, `Product ${variant.product.name} is not available.`);
            }
            const increase = group.desiredQuantity - group.existingQuantity;
            const stockAllocation = Math.min(increase, Math.max(0, variant.stock));
            const preorderIncrease = increase - stockAllocation;
            if (preorderIncrease > 0) {
                const remaining = getPreorderRemaining(variant);
                if (!isPreorderEligible(variant.product, variant)) {
                    throw orderUpdateError(400, `Not enough stock for variant ${variant.value}.`);
                }
                if (remaining !== null && preorderIncrease > remaining) {
                    throw orderUpdateError(400, `The pre-order limit for variant ${variant.value} has been reached.`);
                }
            }
            desiredStockQuantity = group.existingStockQuantity + stockAllocation;
            desiredPreorderQuantity = group.existingPreorderQuantity + preorderIncrease;
        }

        assignGroupAllocation(group, desiredStockQuantity, variant.product);

        const stockDelta = desiredStockQuantity - group.existingStockQuantity;
        if (stockDelta !== 0) {
            const updatedVariant = await tx.productVariant.update({
                where: { id: variantId },
                data: { stock: stockDelta > 0 ? { decrement: stockDelta } : { increment: -stockDelta } },
            });
            await tx.stockMovement.create({
                data: {
                    productVariantId: variantId,
                    type: stockDelta > 0 ? "sale" : "release",
                    quantity: -stockDelta,
                    stockAfter: updatedVariant.stock,
                    reservedAfter: updatedVariant.held,
                    orderId: existingOrder.id,
                    note: stockDelta > 0 ? "Order items updated, stock deducted" : "Order items updated, stock returned",
                    userId,
                },
            });
        }
        await adjustVariantPreorderCount(
            tx,
            variantId,
            desiredPreorderQuantity - group.existingPreorderQuantity
        );
    }

    for (const [productId, group] of productOnlyGroups) {
        const product = await tx.product.findUnique({
            where: { id: productId },
            select: {
                name: true,
                status: true,
                stock: true,
                _count: { select: { variants: true } },
            },
        });
        if (!product) {
            throw orderUpdateError(400, `Not enough stock for product ${productId}.`);
        }

        let desiredStockQuantity;
        if (group.desiredQuantity <= group.existingStockQuantity) {
            desiredStockQuantity = group.desiredQuantity;
        } else if (group.desiredQuantity <= group.existingQuantity) {
            desiredStockQuantity = group.existingStockQuantity;
        } else {
            if (product.status === "OUT_OF_STOCK" || product.status === "SOLD_OUT") {
                throw orderUpdateError(400, `Product ${product.name} is not available.`);
            }
            const increase = group.desiredQuantity - group.existingQuantity;
            if (product._count.variants > 0) {
                // A line without a variant cannot be allocated to a specific
                // size. Preserve the existing product-counter behaviour for
                // in-stock products, and treat added units on a PRE_ORDER
                // product as pre-order units.
                desiredStockQuantity = isProductPreorder(product)
                    ? group.existingStockQuantity
                    : group.existingStockQuantity + increase;
            } else {
                const stockAllocation = Math.min(increase, Math.max(0, product.stock));
                if (stockAllocation < increase && !isProductPreorder(product)) {
                    throw orderUpdateError(400, `Not enough stock for ${product.name}.`);
                }
                desiredStockQuantity = group.existingStockQuantity + stockAllocation;
            }
        }

        assignGroupAllocation(group, desiredStockQuantity, product);
    }

    const existingProductStockQty = getProductStockQuantities(existingOrder.items);
    const desiredProductStockQty = new Map();
    for (const item of desiredItems) {
        const stockQuantity = item.quantity - getItemPreorderQuantity(item);
        desiredProductStockQty.set(
            item.productId,
            (desiredProductStockQty.get(item.productId) || 0) + stockQuantity
        );
    }

    const productIds = new Set([...existingProductStockQty.keys(), ...desiredProductStockQty.keys()]);
    for (const productId of productIds) {
        const delta = (desiredProductStockQty.get(productId) || 0) - (existingProductStockQty.get(productId) || 0);
        if (delta === 0) continue;
        await tx.product.update({
            where: { id: productId },
            data: { stock: delta > 0 ? { decrement: delta } : { increment: -delta } },
        });
    }

    return desiredItems;
}

async function replaceOrderItems(tx, existingOrder, desiredItems) {
    const desiredIds = new Set(desiredItems.map((item) => item.id).filter(Boolean));
    const deletedIds = existingOrder.items.filter((item) => !desiredIds.has(item.id)).map((item) => item.id);
    if (deletedIds.length) {
        await tx.orderItem.deleteMany({ where: { orderId: existingOrder.id, id: { in: deletedIds } } });
    }

    for (const item of desiredItems) {
        const data = {
            productId: item.productId,
            variantId: item.variantId,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            isPreorder: Boolean(item.isPreorder || item.preorderQuantity > 0),
            preorderQuantity: getItemPreorderQuantity(item),
        };
        if (item.id) await tx.orderItem.update({ where: { id: item.id }, data });
        else await tx.orderItem.create({ data: { orderId: existingOrder.id, ...data } });
    }
}

export async function GET(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });
        const { id } = await params;
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ success: false, message: "Invalid order ID." }, { status: 400 });

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
        if (!order) return Response.json({ success: false, message: "Order not found." }, { status: 404 });
        return Response.json({ success: true, message: "Order loaded.", data: formatOrder(order) });
    } catch (error) {
        console.error("Admin single order API error:", error);
        return Response.json({ success: false, message: "Failed to load order." }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });

        const { id } = await params;
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ success: false, message: "Invalid order ID." }, { status: 400 });

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                user: { select: { id: true, name: true, phone: true, email: true } },
            },
        });
        if (!existingOrder) return Response.json({ success: false, message: "Order not found." }, { status: 404 });

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return Response.json({ success: false, message: "Invalid order update." }, { status: 400 });
        }

        const has = (key) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
        const firstPresent = (...keys) => {
            for (const key of keys) if (has(key)) return body[key];
            return undefined;
        };

        const { status, paymentStatus, payment_status } = body;
        const updateData = {};
        let recognized = false;
        let finalNewStatus = null;

        if (status !== undefined) {
            recognized = true;
            const newStatus = String(status).toUpperCase().replaceAll("-", "_");
            if (!VALID_STATUSES.includes(newStatus)) return Response.json({ success: false, message: "Invalid order status." }, { status: 400 });
            updateData.status = newStatus;
            finalNewStatus = newStatus;
        }

        const rawPaymentStatus = paymentStatus ?? payment_status;
        if (rawPaymentStatus !== undefined) {
            recognized = true;
            const newPaymentStatus = String(rawPaymentStatus).toUpperCase().replaceAll("-", "_");
            if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) return Response.json({ success: false, message: "Invalid payment status." }, { status: 400 });
            updateData.paymentStatus = newPaymentStatus;
        }

        const existingPhone = existingOrder.contactPhone || existingOrder.user?.phone || existingOrder.guestPhone || "";
        const existingEmail = existingOrder.contactEmail || existingOrder.user?.email || "";

        const nameValue = firstPresent("name", "contactName", "guestName");
        if (nameValue !== undefined) {
            recognized = true;
            if (typeof nameValue !== "string" || !nameValue.trim()) {
                return Response.json({ success: false, message: "Customer name is required." }, { status: 400 });
            }
            const nextName = nameValue.trim();
            if (existingOrder.contactName !== nextName) updateData.contactName = nextName;
            if (!existingOrder.userId && existingOrder.guestName !== nextName) updateData.guestName = nextName;
        }

        const phoneValue = firstPresent("phone", "contactPhone", "guestPhone");
        if (phoneValue !== undefined) {
            recognized = true;
            const nextPhone = normalizeBdPhone(phoneValue);
            const currentPhone = normalizeBdPhone(existingPhone);
            if (nextPhone !== currentPhone) {
                if (!isValidBdPhone(nextPhone)) {
                    return Response.json({ success: false, message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)." }, { status: 400 });
                }
                updateData.contactPhone = nextPhone;
                if (!existingOrder.userId) updateData.guestPhone = nextPhone;
            } else if (nextPhone && isValidBdPhone(nextPhone) && existingOrder.contactPhone !== nextPhone) {
                // Populate the order snapshot for older account orders.
                updateData.contactPhone = nextPhone;
            }
        }

        const emailValue = firstPresent("email", "contactEmail", "guestEmail");
        if (emailValue !== undefined) {
            recognized = true;
            const nextEmail = normalizeEmail(emailValue);
            const currentEmail = normalizeEmail(existingEmail);
            if (nextEmail !== currentEmail) {
                // Existing-order edits validate an email when one is entered;
                // a legacy order without one can still receive status updates.
                if (!nextEmail && currentEmail) {
                    return Response.json({ success: false, message: "Customer email cannot be cleared." }, { status: 400 });
                }
                if (nextEmail && !isValidEmail(nextEmail)) {
                    return Response.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
                }
                updateData.contactEmail = nextEmail || null;
            } else if (nextEmail && isValidEmail(nextEmail) && existingOrder.contactEmail !== nextEmail) {
                updateData.contactEmail = nextEmail;
            }
        }

        const addressValue = firstPresent("address", "shippingAddress", "shipping_address");
        if (addressValue !== undefined) {
            recognized = true;
            if (typeof addressValue !== "string" || !addressValue.trim()) {
                return Response.json({ success: false, message: "Delivery address is required." }, { status: 400 });
            }
            updateData.shippingAddress = addressValue.trim();
        }

        if (has("district")) {
            recognized = true;
            updateData.district = body.district === null ? null : String(body.district).trim() || null;
        }

        const paymentMethodValue = firstPresent("payment_method", "paymentMethod");
        if (paymentMethodValue !== undefined) {
            recognized = true;
            const nextMethod = String(paymentMethodValue || "").trim();
            if (!nextMethod || nextMethod.length > 50) {
                return Response.json({ success: false, message: "Payment method is required." }, { status: 400 });
            }
            updateData.paymentMethod = nextMethod;
        }

        const shippingValue = firstPresent("shipping_cost", "shippingCost", "shippingFee");
        if (shippingValue !== undefined) {
            recognized = true;
            updateData.shippingFee = parseNonNegativeMoney(shippingValue, "Shipping cost");
        }

        const advanceValue = firstPresent("advance_payment", "advancePayment");
        if (advanceValue !== undefined) {
            recognized = true;
            updateData.advancePayment = parseNonNegativeMoney(advanceValue, "Advance payment");
        }

        const courierValue = firstPresent("courier_entry", "courierEntry", "courier");
        if (courierValue !== undefined) {
            recognized = true;
            const nextCourier = courierValue === null || courierValue === 0 ? "" : String(courierValue).trim();
            if (nextCourier.length > 100) return Response.json({ success: false, message: "Courier value is too long." }, { status: 400 });
            updateData.courierEntry = nextCourier || null;
        }

        const deliveryNotesValue = firstPresent("delivery_notes", "deliveryNotes");
        if (deliveryNotesValue !== undefined) {
            recognized = true;
            const nextNotes = deliveryNotesValue === null ? "" : String(deliveryNotesValue).trim();
            if (nextNotes.length > 1000) return Response.json({ success: false, message: "Delivery notes are too long." }, { status: 400 });
            updateData.deliveryNotes = nextNotes || null;
        }

        let desiredItems = null;
        let compositionChanged = false;
        if (has("items")) {
            recognized = true;
            const existingById = new Map(existingOrder.items.map((item) => [item.id, item]));
            const productIds = Array.isArray(body.items)
                ? [...new Set(body.items.map((item) => Number(item?.product_id ?? item?.productId ?? existingById.get(Number(item?.id))?.productId)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const products = productIds.length
                ? await prisma.product.findMany({
                    where: { id: { in: productIds } },
                    include: { variants: { select: { id: true, productId: true, name: true, value: true } } },
                })
                : [];
            desiredItems = buildDesiredItems(body.items, existingOrder, new Map(products.map((product) => [product.id, product])));
            compositionChanged = itemsCompositionChanged(existingOrder.items, desiredItems);
        }

        const finalStatus = updateData.status || existingOrder.status;
        const cancellationTransition =
            (existingOrder.status !== "CANCELLED" && finalStatus === "CANCELLED") ||
            (existingOrder.status === "CANCELLED" && finalStatus !== "CANCELLED");

        if (compositionChanged && (existingOrder.status === "CANCELLED" || existingOrder.status === "DELIVERED")) {
            throw orderUpdateError(409, "Item quantities cannot be changed on a cancelled or delivered order.");
        }
        if (compositionChanged && cancellationTransition) {
            throw orderUpdateError(409, "Save item changes separately from cancelling or reactivating this order.");
        }

        let finalTotal = Number(existingOrder.totalAmount);
        if (desiredItems || Object.prototype.hasOwnProperty.call(updateData, "shippingFee")) {
            const itemsSubtotal = desiredItems
                ? desiredItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
                : Number(existingOrder.totalAmount) - Number(existingOrder.shippingFee);
            const finalShipping = Object.prototype.hasOwnProperty.call(updateData, "shippingFee")
                ? Number(updateData.shippingFee)
                : Number(existingOrder.shippingFee);
            finalTotal = Math.round((itemsSubtotal + finalShipping) * 100) / 100;
            updateData.totalAmount = finalTotal;
        }

        const finalAdvance = Object.prototype.hasOwnProperty.call(updateData, "advancePayment")
            ? Number(updateData.advancePayment)
            : Number(existingOrder.advancePayment);
        const totalRecalculated = Boolean(desiredItems || Object.prototype.hasOwnProperty.call(updateData, "shippingFee"));
        if ((advanceValue !== undefined || totalRecalculated) && (!Number.isFinite(finalAdvance) || finalAdvance < 0 || finalAdvance > finalTotal + 0.005)) {
            throw orderUpdateError(400, "Advance payment cannot be more than the order total.");
        }

        if (!recognized) return Response.json({ success: false, message: "No valid fields to update." }, { status: 400 });

        const updatedOrder = await prisma.$transaction(async (tx) => {
            if (desiredItems) {
                const resolved = await resolveLegacyVariantIds(tx, existingOrder, desiredItems);
                let effectiveDesiredItems = resolved.desiredItems;
                if (compositionChanged && !cancellationTransition) {
                    effectiveDesiredItems = await applyItemStockDeltas(tx, existingOrder, effectiveDesiredItems, resolved.existingVariantByItemId, auth.user.userId);
                }
                await replaceOrderItems(tx, existingOrder, effectiveDesiredItems);
            }

            if (Object.keys(updateData).length > 0) {
                await tx.order.update({ where: { id: orderId }, data: updateData });
            }

            // Stock was deducted when the order was placed. Cancelling
            // returns it (release); moving a cancelled order back to an
            // active status deducts the current item quantities again.
            if (finalNewStatus === "CANCELLED" && existingOrder.status !== "CANCELLED") {
                await restoreOrderStock(tx, existingOrder, auth.user.userId, "Order cancelled, stock returned");
            } else if (finalNewStatus && finalNewStatus !== "CANCELLED" && existingOrder.status === "CANCELLED") {
                await redeductOrderStock(tx, existingOrder, auth.user.userId);
            }

            // A pre-order can only enter shipment/delivery once received
            // stock covers its remaining pre-order units. Allocation turns
            // those units into a normal ledger-backed sale at that point.
            if (finalStatus === "SHIPPED" || finalStatus === "DELIVERED") {
                await allocatePreorderStock(tx, orderId, auth.user.userId);
            }

            return tx.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
        });

        return Response.json({ success: true, message: "Order updated.", data: formatOrder(updatedOrder) });
    } catch (error) {
        if (error?.code === "INSUFFICIENT_STOCK" || Number.isInteger(error?.status)) {
            return Response.json({ success: false, message: error.message }, { status: error.status || 400 });
        }
        console.error("Admin update order API error:", error);
        return Response.json({ success: false, message: "Failed to update order." }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });

        const { id } = await params;
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ success: false, message: "Invalid order ID." }, { status: 400 });

        const existingOrder = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (!existingOrder) return Response.json({ success: false, message: "Order not found." }, { status: 404 });
        if (existingOrder.status === "DELIVERED") return Response.json({ success: false, message: "Delivered orders cannot be deleted." }, { status: 409 });

        await prisma.$transaction(async (tx) => {
            // Deleting an order that was never cancelled must not silently
            // keep its stock: return it first, exactly like a cancellation.
            // (StockMovement.orderId is a plain Int, so the release rows
            // survive the order deletion as history.)
            if (existingOrder.status !== "CANCELLED") {
                await restoreOrderStock(tx, existingOrder, auth.user.userId, "Order deleted, stock returned");
            }
            await tx.order.delete({ where: { id: orderId } });
        });
        return Response.json({ success: true, message: "Order deleted." });
    } catch (error) {
        console.error("Admin delete order API error:", error);
        return Response.json({ success: false, message: "Failed to delete order." }, { status: 500 });
    }
}