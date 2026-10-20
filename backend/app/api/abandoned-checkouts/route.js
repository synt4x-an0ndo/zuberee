import {
    resolveAbandonedSessionId,
    syncAbandonedCheckout,
} from "@/lib/abandonedCheckout.js";

/**
 * POST /api/abandoned-checkouts - public.
 *
 * Saves or updates the single row that belongs to this cart. The row is
 * normally opened by POST /api/cart the moment the first item is added; this
 * enriches it with the contact and shipping details the shopper types on the
 * checkout form. It is called repeatedly while they type, so every field is
 * optional and only values actually supplied are written.
 *
 * Body:
 *   cartItems  [{ productId, title, quantity, unitPrice, variantId? }]  required
 *   sessionId  optional - the server prefers the cart session cookie and only
 *              falls back to this when that cookie is unavailable
 *   userId     optional - set by the storefront for signed-in shoppers
 *   name, phone, email, address, district   optional contact/shipping details
 */
function cleanString(value) {
    if (value === null || value === undefined) return null;

    const trimmed = String(value).trim();

    return trimmed === "" ? null : trimmed;
}

export async function POST(request) {
    try {
        const body = await request.json();

        const {
            sessionId: bodySessionId,
            userId: bodyUserId,
            cartItems,
            name,
            phone,
            email,
            address,
            district,
        } = body;

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return Response.json(
                {
                    success: false,
                    message: "cartItems is required and must not be empty.",
                },
                { status: 400 }
            );
        }

        const parsedUserId = Number(bodyUserId);
        const userId =
            Number.isInteger(parsedUserId) && parsedUserId > 0
                ? parsedUserId
                : null;

        const sessionId = await resolveAbandonedSessionId(request, bodySessionId);

        if (!sessionId && !userId) {
            return Response.json(
                { success: false, message: "sessionId or userId required." },
                { status: 400 }
            );
        }

        const record = await syncAbandonedCheckout({
            sessionId,
            userId,
            data: {
                cartItems,
                name: cleanString(name),
                phone: cleanString(phone),
                email: cleanString(email),
                address: cleanString(address),
                district: cleanString(district),
            },
        });

        if (!record) {
            return Response.json(
                { success: false, message: "Failed to save abandoned checkout." },
                { status: 500 }
            );
        }

        return Response.json(
            {
                success: true,
                message: "Abandoned checkout saved.",
                data: record,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Save abandoned checkout API error:", error);

        return Response.json(
            { success: false, message: "Failed to save abandoned checkout." },
            { status: 500 }
        );
    }
}
