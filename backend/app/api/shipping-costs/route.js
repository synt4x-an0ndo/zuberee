import prisma from "../../../directory/prisma/prisma.js";

/**
 * Public shipping rates for the storefront checkout.
 *
 * Rates are managed in Admin -> Shipping costs (stored as ShippingCost
 * rows; the newest row wins). This read-only endpoint exposes the latest
 * rates without admin auth so checkout can quote the delivery charge for
 * the shopper's district instead of "confirmed on call". The orders API
 * recomputes the same fee server-side when an order is placed, so the
 * amount stored on the order never depends on the client.
 */
const DEFAULTS = { insideDhaka: 80, outsideDhaka: 150, oneShippingCost: null };

export async function GET() {
    try {
        const latest = await prisma.shippingCost.findFirst({
            orderBy: { createdAt: "desc" },
        });

        const rates = latest || DEFAULTS;

        return Response.json({
            success: true,
            data: {
                inside_dhaka: Number(rates.insideDhaka),
                outside_dhaka: Number(rates.outsideDhaka),
                one_shipping_cost:
                    rates.oneShippingCost === null
                        ? null
                        : Number(rates.oneShippingCost),
            },
        });
    } catch (error) {
        console.error("Public shipping costs API error:", error);

        return Response.json(
            { success: false, message: "Failed to load shipping costs." },
            { status: 500 }
        );
    }
}
