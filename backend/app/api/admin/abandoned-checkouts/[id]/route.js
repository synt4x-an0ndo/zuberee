import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { CHECKOUT_STATUSES as VALID_STATUSES } from "@/lib/checkoutStatuses.js";

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

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolve every snapshotted cart line against the live catalogue.
 *
 * The snapshot only stores productId/title/quantity/unitPrice, so it can go
 * stale: a product may be deleted, deactivated or repriced between the moment
 * the shopper abandoned checkout and the moment an admin acts on it. Each row
 * is flagged so the dashboard can show the admin exactly what will be charged
 * before anything is written.
 */
function resolveItems(cartItems, products) {
    const byId = new Map(products.map((product) => [product.id, product]));
    const items = [];

    for (const raw of cartItems) {
        const productId = Number(raw?.productId ?? raw?.product_id ?? NaN);
        const quantity = Math.max(1, Math.trunc(toNumber(raw?.quantity, 1)) || 1);
        const snapshotUnitPrice = toNumber(raw?.unitPrice ?? raw?.unit_price, 0);
        const product = byId.get(productId);

        if (!product || !product.isActive) {
            items.push({
                product_id: Number.isInteger(productId) ? productId : null,
                title: raw?.title ?? raw?.name ?? product?.name ?? "Unavailable product",
                quantity,
                snapshot_unit_price: snapshotUnitPrice,
                unit_price: snapshotUnitPrice,
                available: false,
                stock: 0,
                note: product ? "This product is no longer active." : "This product no longer exists.",
            });
            continue;
        }

        const unitPrice =
            product.discount !== null && product.discount !== undefined
                ? Number(product.discount)
                : Number(product.price);

        items.push({
            product_id: product.id,
            title: product.name,
            quantity,
            snapshot_unit_price: snapshotUnitPrice,
            unit_price: unitPrice,
            available: true,
            stock: Math.max(0, Number(product.stock || 0)),
            note:
                snapshotUnitPrice > 0 && Math.abs(snapshotUnitPrice - unitPrice) > 0.005
                    ? `Price changed since abandonment (was ৳${snapshotUnitPrice}).`
                    : null,
        });
    }

    return items;
}

/**
 * GET /api/admin/abandoned-checkouts/:id
 *
 * Returns the checkout plus everything the conversion form needs: live price
 * and stock for each snapshotted line, the account email (the snapshot has no
 * email field but an order requires one), and the current shipping rates so
 * the fee can be recomputed as the admin picks a district.
 */
export async function GET(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
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

        const checkout = await prisma.abandonedCheckout.findUnique({
            where: { id: checkoutId },
        });

        if (!checkout) {
            return Response.json(
                { success: false, message: "Checkout not found." },
                { status: 404 }
            );
        }

        const cartItems = Array.isArray(checkout.cartItems) ? checkout.cartItems : [];

        const productIds = [
            ...new Set(
                cartItems
                    .map((item) => Number(item?.productId ?? item?.product_id))
                    .filter((value) => Number.isInteger(value))
            ),
        ];

        const [products, rates, account] = await Promise.all([
            productIds.length > 0
                ? prisma.product.findMany({ where: { id: { in: productIds } } })
                : Promise.resolve([]),
            prisma.shippingCost.findFirst({ orderBy: { createdAt: "desc" } }),
            checkout.userId
                ? prisma.user.findUnique({
                      where: { id: checkout.userId },
                      select: { email: true, name: true, phone: true },
                  })
                : Promise.resolve(null),
        ]);

        const items = resolveItems(cartItems, products);
        const subtotal = items.reduce(
            (sum, item) => sum + item.unit_price * item.quantity,
            0
        );

        const shippingRates = rates
            ? {
                  one_shipping_cost:
                      rates.oneShippingCost === null || rates.oneShippingCost === undefined
                          ? null
                          : Number(rates.oneShippingCost),
                  inside_dhaka: Number(rates.insideDhaka),
                  outside_dhaka: Number(rates.outsideDhaka),
              }
            : null;

        const defaultShippingFee = rates
            ? rates.oneShippingCost !== null && rates.oneShippingCost !== undefined
                ? Number(rates.oneShippingCost)
                : Number(rates.insideDhaka)
            : 0;

        const safeFee = Number.isFinite(defaultShippingFee) ? defaultShippingFee : 0;

        return Response.json({
            success: true,
            message: "Abandoned checkout loaded.",
            data: {
                ...formatCheckout(checkout),
                items,
                suggested: {
                    contact_name: checkout.name || account?.name || "",
                    contact_phone: checkout.phone || account?.phone || "",
                    contact_email: account?.email || "",
                    shipping_address: checkout.address || "",
                    district: "",
                    shipping_fee: safeFee,
                    subtotal,
                    total: subtotal + safeFee,
                },
                shipping_rates: shippingRates,
            },
        });
    } catch (error) {
        console.error("Admin abandoned checkout detail API error:", error);

        return Response.json(
            { success: false, message: "Failed to load abandoned checkout." },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/abandoned-checkouts/:id
 *
 * Body: { is_recovered?: boolean, status?: one of CHECKOUT_STATUSES }
 * At least one field is required. Converting is handled by the sibling
 * /convert route, which also flips these fields once the order exists.
 */
export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
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
            body = {};
        }

        const data = {};

        if (body.is_recovered !== undefined) {
            if (typeof body.is_recovered !== "boolean") {
                return Response.json(
                    { success: false, message: "is_recovered must be a boolean." },
                    { status: 400 }
                );
            }

            data.isRecovered = body.is_recovered;
        }

        if (body.status !== undefined) {
            const status = String(body.status).toLowerCase();

            if (!VALID_STATUSES.includes(status)) {
                return Response.json(
                    {
                        success: false,
                        message: `Invalid status. Use one of: ${VALID_STATUSES.join(", ")}.`,
                    },
                    { status: 400 }
                );
            }

            data.status = status;
        }

        if (Object.keys(data).length === 0) {
            return Response.json(
                {
                    success: false,
                    message: "Nothing to update. Send is_recovered and/or status.",
                },
                { status: 400 }
            );
        }

        const updated = await prisma.abandonedCheckout.update({
            where: { id: checkoutId },
            data,
        });

        return Response.json({
            success: true,
            message:
                data.isRecovered === true
                    ? "Checkout marked as recovered."
                    : "Checkout updated.",
            data: formatCheckout(updated),
        });
    } catch (error) {
        if (error?.code === "P2025") {
            return Response.json(
                { success: false, message: "Checkout not found." },
                { status: 404 }
            );
        }

        console.error("Admin abandoned checkout update API error:", error);

        return Response.json(
            { success: false, message: "Failed to update abandoned checkout." },
            { status: 500 }
        );
    }
}
