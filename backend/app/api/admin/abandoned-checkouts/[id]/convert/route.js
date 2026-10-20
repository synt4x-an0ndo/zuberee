import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { requireValidOrderContact } from "@/lib/contactValidation.js";
import { allocateOrderEntries } from "@/lib/preorder.js";

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

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const checkoutId = Number(id);

        if (!Number.isInteger(checkoutId)) {
            return Response.json(
                { success: false, message: "Invalid checkout id." },
                { status: 400 }
            );
        }

        let body = {};

        try {
            body = await request.json();
        } catch {
            return Response.json(
                { success: false, message: "Request body is required." },
                { status: 400 }
            );
        }

        const {
            items: bodyItems,
            district,
            shippingAddress,
            contactName,
            contactPhone,
            contactEmail,
            shippingFee = 0,
            advancePayment = 0,
            paymentMethod = "cash",
        } = body;

        const checkout = await prisma.abandonedCheckout.findUnique({
            where: { id: checkoutId },
        });

        if (!checkout) {
            return Response.json(
                { success: false, message: "Checkout not found." },
                { status: 404 }
            );
        }

        if (checkout.convertedOrderId) {
            return Response.json(
                {
                    success: false,
                    message: `This checkout was already converted to order #${checkout.convertedOrderId}.`,
                },
                { status: 409 }
            );
        }

        const finalShippingAddress = shippingAddress
            ? String(shippingAddress).trim()
            : String(checkout.address || "").trim();

        if (!finalShippingAddress) {
            return Response.json(
                { success: false, message: "Shipping address is required." },
                { status: 400 }
            );
        }

        const finalContactName = String(
            contactName ?? checkout.name ?? ""
        ).trim();

        if (!finalContactName) {
            return Response.json(
                { success: false, message: "Customer name is required." },
                { status: 400 }
            );
        }

        let finalContact;

        try {
            finalContact = requireValidOrderContact({
                phone: contactPhone ?? checkout.phone ?? "",
                email: contactEmail ?? "",
            });
        } catch (validationError) {
            return Response.json(
                { success: false, message: validationError.message },
                { status: validationError.status || 400 }
            );
        }

        let rawItems = Array.isArray(bodyItems) ? bodyItems : [];

        if (rawItems.length === 0) {
            rawItems = Array.isArray(checkout.cartItems) ? checkout.cartItems : [];
        }

        if (rawItems.length === 0) {
            return Response.json(
                { success: false, message: "No items to convert." },
                { status: 400 }
            );
        }

        const productIds = [
            ...new Set(
                rawItems
                    .map((item) => Number(item?.productId ?? item?.product_id))
                    .filter((value) => Number.isInteger(value))
            ),
        ];

        if (productIds.length === 0) {
            return Response.json(
                { success: false, message: "No valid products in this checkout." },
                { status: 400 }
            );
        }

        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { variants: true },
        });

        const productMap = new Map(products.map((product) => [product.id, product]));

        const orderItemsData = [];
        let subtotal = 0;

        for (const raw of rawItems) {
            const productId = Number(raw?.productId ?? raw?.product_id);
            const quantity = Number(raw?.quantity ?? 1);

            if (!Number.isInteger(quantity) || quantity < 1) {
                return Response.json(
                    { success: false, message: "Invalid item quantity." },
                    { status: 400 }
                );
            }

            const product = productMap.get(productId);

            if (!product || !product.isActive) {
                return Response.json(
                    { success: false, message: `Product ${productId} not available.` },
                    { status: 404 }
                );
            }

            // Same rule as POST /api/orders: the discounted price wins when set.
            // The snapshot's stored unitPrice is only ever shown as a reference.
            let unitPrice = Number(product.price);

            if (product.discount !== null && product.discount !== undefined) {
                unitPrice = Number(product.discount);
            }

            orderItemsData.push({
                product,
                variant: null,
                productId,
                variantId: null,
                size: raw?.size ?? null,
                quantity,
                unitPrice,
            });

            subtotal += unitPrice * quantity;
        }

        try {
            allocateOrderEntries(orderItemsData);
        } catch (allocationError) {
            return Response.json(
                { success: false, message: allocationError.message },
                { status: allocationError.status || 400 }
            );
        }

        let computedShippingFee = null;

        try {
            const rates = await prisma.shippingCost.findFirst({
                orderBy: { createdAt: "desc" },
            });

            if (rates) {
                if (
                    rates.oneShippingCost !== null &&
                    rates.oneShippingCost !== undefined
                ) {
                    computedShippingFee = Number(rates.oneShippingCost);
                } else if (district) {
                    computedShippingFee =
                        String(district).trim().toLowerCase() === "dhaka"
                            ? Number(rates.insideDhaka)
                            : Number(rates.outsideDhaka);
                }
            }
        } catch (rateError) {
            console.error("Shipping rate lookup failed:", rateError);
        }

        const finalShippingFee =
            computedShippingFee !== null && Number.isFinite(computedShippingFee)
                ? computedShippingFee
                : Number(shippingFee) || 0;

        const finalAdvancePayment = Number(advancePayment) || 0;

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId: checkout.userId ?? null,
                    guestName: checkout.userId ? null : finalContactName,
                    guestPhone: checkout.userId ? null : finalContact.phone,
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
                    items: {
                        create: orderItemsData.map((item) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            size: item.size ? String(item.size) : null,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            isPreorder: item.isPreorder,
                            preorderQuantity: item.preorderQuantity,
                        })),
                    },
                },
                include: ORDER_INCLUDE,
            });

            // Variant-less lines draw from product-level stock, matching the
            // behaviour of POST /api/orders when no variant is supplied.
            for (const item of orderItemsData) {
                if (item.stockQuantity > 0) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.stockQuantity } },
                    });
                }
            }

            const updatedCheckout = await tx.abandonedCheckout.update({
                where: { id: checkoutId },
                data: {
                    isRecovered: true,
                    status: "converted",
                    convertedOrderId: order.id,
                    convertedAt: new Date(),
                },
            });

            return { order, checkout: updatedCheckout };
        });

        return Response.json(
            {
                success: true,
                message: `Converted to order #${result.order.id}.`,
                data: {
                    order: {
                        id: result.order.id,
                        status: "pending",
                        payment_status: "pending",
                        total_amount: Number(result.order.totalAmount),
                        shipping_fee: Number(result.order.shippingFee),
                        items: result.order.items.map((item) => ({
                            product_id: item.productId,
                            title: item.product?.name ?? null,
                            quantity: item.quantity,
                            unit_price: Number(item.unitPrice),
                        })),
                    },
                    checkout: formatCheckout(result.checkout),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Convert abandoned checkout API error:", error);

        return Response.json(
            { success: false, message: "Failed to convert checkout into an order." },
            { status: 500 }
        );
    }
}
