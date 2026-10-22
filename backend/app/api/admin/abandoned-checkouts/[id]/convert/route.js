import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { requireValidOrderContact } from "@/lib/contactValidation.js";
import { allocateOrderEntries } from "@/lib/preorder.js";
import {
    adjustProductStock,
    adjustVariantStock,
    inventoryError,
    isTransactionConflict,
    lockAbandonedCheckout,
    lockProductFamilies,
    syncVariantProductStock,
} from "@/lib/inventory.js";

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, sku: true },
            },
            variant: {
                select: { id: true, name: true, value: true },
            },
        },
    },
};

function formatCheckout(c) {
    return {
        id: c.id,
        session_id: c.sessionId,
        user_id: c.userId,
        cart_items: c.cartItems,
        name: c.name,
        phone: c.phone,
        address: c.address,
        is_recovered: c.isRecovered,
        status: c.status,
        converted_order_id: c.convertedOrderId,
        converted_at: c.convertedAt,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
    };
}

/**
 * POST /api/admin/abandoned-checkouts/:id/convert
 *
 * Turns an abandoned checkout into a real order. The dashboard opens a
 * pre-filled confirmation form first, so every value below can be reviewed or
 * edited by the admin before anything is written.
 *
 * Body:
 *   items           [{ productId, quantity, size? }]  - defaults to the snapshot
 *   contactName     string   - defaults to the snapshot name
 *   contactPhone    string   - defaults to the snapshot phone; must be a valid BD mobile
 *   contactEmail    string   - REQUIRED (the snapshot never stored one)
 *   shippingAddress string   - defaults to the snapshot address
 *   district        string   - used to pick the shipping rate
 *   shippingFee     number   - fallback when no rate table row exists
 *   advancePayment  number   - default 0
 *   paymentMethod   string   - default "cash"
 *
 * Mirrors POST /api/orders: prices come from the live catalogue, stock is
 * allocated through allocateOrderEntries, and the order is created PENDING /
 * PENDING inside a transaction that also stamps the checkout as converted.
 */
export async function POST(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });

        const { id } = await params;
        const checkoutId = Number(id);
        if (!Number.isInteger(checkoutId) || checkoutId <= 0) return Response.json({ success: false, message: "Invalid checkout id." }, { status: 400 });

        let body;
        try { body = await request.json(); } catch { return Response.json({ success: false, message: "Request body is required." }, { status: 400 }); }
        const { items: bodyItems, district, shippingAddress, contactName, contactPhone, contactEmail, shippingFee = 0, advancePayment = 0, paymentMethod = "cash" } = body;

        // This preliminary read is only used to prefill the confirmation form.
        // The transaction below locks and re-reads the row before conversion.
        const checkout = await prisma.abandonedCheckout.findUnique({ where: { id: checkoutId } });
        if (!checkout) return Response.json({ success: false, message: "Checkout not found." }, { status: 404 });
        if (checkout.convertedOrderId) return Response.json({ success: false, message: `This checkout was already converted to order #${checkout.convertedOrderId}.` }, { status: 409 });

        const finalShippingAddress = shippingAddress ? String(shippingAddress).trim() : String(checkout.address || "").trim();
        if (!finalShippingAddress) return Response.json({ success: false, message: "Shipping address is required." }, { status: 400 });
        const finalContactName = String(contactName ?? checkout.name ?? "").trim();
        if (!finalContactName) return Response.json({ success: false, message: "Customer name is required." }, { status: 400 });

        let finalContact;
        try { finalContact = requireValidOrderContact({ phone: contactPhone ?? checkout.phone ?? "", email: contactEmail ?? "" }); }
        catch (validationError) { return Response.json({ success: false, message: validationError.message }, { status: validationError.status || 400 }); }

        let computedShippingFee = null;
        try {
            const rates = await prisma.shippingCost.findFirst({ orderBy: { createdAt: "desc" } });
            if (rates) {
                if (rates.oneShippingCost !== null && rates.oneShippingCost !== undefined) computedShippingFee = Number(rates.oneShippingCost);
                else if (district) computedShippingFee = String(district).trim().toLowerCase() === "dhaka" ? Number(rates.insideDhaka) : Number(rates.outsideDhaka);
            }
        } catch (rateError) { console.error("Shipping rate lookup failed:", rateError); }
        const finalShippingFee = computedShippingFee !== null && Number.isFinite(computedShippingFee) ? computedShippingFee : Number(shippingFee) || 0;
        const finalAdvancePayment = Number(advancePayment) || 0;

        const result = await prisma.$transaction(async (tx) => {
            if (!await lockAbandonedCheckout(tx, checkoutId)) throw inventoryError("Checkout not found.", 404);
            const lockedCheckout = await tx.abandonedCheckout.findUnique({ where: { id: checkoutId } });
            if (!lockedCheckout) throw inventoryError("Checkout not found.", 404);
            if (lockedCheckout.convertedOrderId) throw inventoryError(`This checkout was already converted to order #${lockedCheckout.convertedOrderId}.`, 409);

            const rawItems = Array.isArray(bodyItems) && bodyItems.length > 0
                ? bodyItems
                : Array.isArray(lockedCheckout.cartItems) ? lockedCheckout.cartItems : [];
            if (!rawItems.length) throw inventoryError("No items to convert.", 400);
            const productIds = [...new Set(rawItems.map((item) => Number(item?.productId ?? item?.product_id)).filter((value) => Number.isInteger(value) && value > 0))];
            if (!productIds.length) throw inventoryError("No valid products in this checkout.", 400);

            await lockProductFamilies(tx, productIds);
            const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: { variants: true, inventory: true } });
            const productMap = new Map(products.map((product) => [product.id, product]));
            const entries = [];
            let subtotal = 0;
            for (const raw of rawItems) {
                const productId = Number(raw?.productId ?? raw?.product_id);
                const variantId = raw?.variantId ?? raw?.variant_id ?? null;
                const quantity = Number(raw?.quantity ?? 1);
                if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1) throw inventoryError("Invalid item quantity or product.", 400);
                const product = productMap.get(productId);
                if (!product || !product.isActive) throw inventoryError(`Product ${productId} not available.`, 404);
                let variant = null;
                let unitPrice = product.discount !== null && product.discount !== undefined ? Number(product.discount) : Number(product.price);
                if (variantId !== null && variantId !== "") {
                    variant = product.variants.find((row) => row.id === Number(variantId)) || null;
                    if (!variant) throw inventoryError(`Variant ${variantId} not found.`, 404);
                    if (!variant.isActive) throw inventoryError(`Variant ${variant.value} is not available.`, 400);
                    if (variant.price !== null) unitPrice = Number(variant.price);
                } else if (product.variants.length > 0) {
                    throw inventoryError(`Please select a variant for ${product.name}.`, 400);
                }
                entries.push({ product, variant, productId, variantId: variant?.id ?? null, size: variant?.value ? String(variant.value) : raw?.size ?? raw?.selected_size ?? null, quantity, unitPrice });
                subtotal += unitPrice * quantity;
            }
            allocateOrderEntries(entries);

            const order = await tx.order.create({
                data: {
                    userId: lockedCheckout.userId ?? null,
                    guestName: lockedCheckout.userId ? null : finalContactName,
                    guestPhone: lockedCheckout.userId ? null : finalContact.phone,
                    contactName: finalContactName,
                    contactPhone: finalContact.phone,
                    contactEmail: finalContact.email,
                    status: "PENDING",
                    paymentStatus: "PENDING",
                    totalAmount: subtotal + finalShippingFee,
                    shippingFee: finalShippingFee,
                    shippingAddress: finalShippingAddress,
                    district: district ? String(district).trim() : null,
                    advancePayment: finalAdvancePayment,
                    paymentMethod: String(paymentMethod),
                    items: { create: entries.map((item) => ({ productId: item.productId, variantId: item.variantId, size: item.size ? String(item.size) : null, quantity: item.quantity, unitPrice: item.unitPrice, isPreorder: item.isPreorder, preorderQuantity: item.preorderQuantity, stockMode: item.usesVariantStock ? "VARIANT" : "PRODUCT" })) },
                },
                include: ORDER_INCLUDE,
            });

            const variantProductIds = new Set();
            for (const item of entries) {
                if (item.usesVariantStock && item.stockQuantity > 0) {
                    await adjustVariantStock(tx, { variantId: item.variantId, delta: -item.stockQuantity, type: "sale", note: "Abandoned checkout converted", userId: auth.user.userId, orderId: order.id });
                    variantProductIds.add(item.productId);
                }
                if (item.usesVariantStock && item.preorderQuantity > 0) {
                    await tx.productVariant.update({ where: { id: item.variantId }, data: { preorderCount: { increment: item.preorderQuantity } } });
                }
                if (!item.usesVariantStock && item.stockQuantity > 0) {
                    await adjustProductStock(tx, { productId: item.productId, delta: -item.stockQuantity, type: "sale", note: "Abandoned checkout converted", userId: auth.user.userId, orderId: order.id });
                }
            }
            await syncVariantProductStock(tx, [...variantProductIds]);

            const updatedCheckout = await tx.abandonedCheckout.update({
                where: { id: checkoutId },
                data: { isRecovered: true, status: "converted", convertedOrderId: order.id, convertedAt: new Date() },
            });
            return { order, checkout: updatedCheckout };
        }, { isolationLevel: "Serializable" });

        return Response.json({
            success: true,
            message: `Converted to order #${result.order.id}.`,
            data: {
                order: {
                    id: result.order.id,
                    status: "pending",
                    payment_status: "pending",
                    total_amount: Number(result.order.totalAmount),
                    shipping_fee: Number(result.order.shippingFee),
                    items: result.order.items.map((item) => ({ product_id: item.productId, product_variant_id: item.variantId ?? null, title: item.product?.name ?? null, quantity: item.quantity, unit_price: Number(item.unitPrice) })),
                },
                checkout: formatCheckout(result.checkout),
            },
        }, { status: 201 });
    } catch (error) {
        if (Number.isInteger(error?.status)) return Response.json({ success: false, message: error.message }, { status: error.status });
        if (isTransactionConflict(error)) return Response.json({ success: false, message: "Stock changed while this checkout was being converted. Please try again." }, { status: 409 });
        console.error("Convert abandoned checkout API error:", error);
        return Response.json({ success: false, message: "Failed to convert checkout into an order." }, { status: 500 });
    }
}
