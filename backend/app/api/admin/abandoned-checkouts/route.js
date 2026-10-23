import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { CHECKOUT_STATUSES as VALID_STATUSES } from "@/lib/checkoutStatuses.js";

/**
 * Parse a YYYY-MM-DD (or full ISO) filter bound. A bare date is widened to the
 * start (or end) of that day, so "to" still includes everything on the last day.
 */
function parseDay(value, endOfDay = false) {
    if (!value) return null;

    const text = String(value).trim();
    const isDayOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
    const date = new Date(isDayOnly ? `${text}T00:00:00.000Z` : text);

    if (Number.isNaN(date.getTime())) return null;

    if (isDayOnly && endOfDay) date.setUTCHours(23, 59, 59, 999);

    return date;
}

/**
 * Attach each product's primary image to its stored cart line so the admin
 * table can show a thumbnail. Best-effort - a missing image just stays null.
 */
function decorateCartItems(cartItems, imageMap) {
    if (!Array.isArray(cartItems)) return cartItems;

    return cartItems.map((item) => ({
        ...item,
        image: imageMap.get(Number(item?.productId)) ?? null,
    }));
}

function formatCheckout(c, imageMap = new Map()) {
    return {
        id: c.id,
        session_id: c.sessionId,
        user_id: c.userId,
        cart_items: decorateCartItems(c.cartItems, imageMap),
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        district: c.district,
        is_recovered: c.isRecovered,
        status: c.status,
        converted_order_id: c.convertedOrderId,
        converted_at: c.convertedAt,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status")?.trim();
        const recovered = searchParams.get("recovered")?.trim();
        const from = searchParams.get("from")?.trim();
        const to = searchParams.get("to")?.trim();

        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(
            100,
            Math.max(1, Number(searchParams.get("per_page") ?? 50))
        );

        const skip = (page - 1) * perPage;

        /**
         * scope:
         *   "actionable" (default) - hides rows already linked to an order and
         *     rows with no contact details (a cart was tracked but the shopper
         *     never reached the form, so there is nothing to recover).
         *   "all" - everything, including converted and cart-only rows.
         */
        const scope = (searchParams.get("scope")?.trim() || "actionable").toLowerCase();

        const where = { AND: [] };

        if (search) {
            where.AND.push({
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { sessionId: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        const statusFilter =
            status && VALID_STATUSES.includes(status.toLowerCase())
                ? status.toLowerCase()
                : null;

        if (statusFilter) {
            where.AND.push({ status: statusFilter });
        }

        if (recovered === "true") {
            where.AND.push({ isRecovered: true });
        } else if (recovered === "false") {
            where.AND.push({ isRecovered: false });
        }

        // Optional date range on when the checkout was abandoned.
        const fromDate = parseDay(from, false);
        const toDate = parseDay(to, true);

        if (fromDate) where.AND.push({ createdAt: { gte: fromDate } });
        if (toDate) where.AND.push({ createdAt: { lte: toDate } });

        if (scope === "actionable") {
            // A row already turned into an order is not incomplete. Still let the
            // admin browse them via Status = Converted.
            if (statusFilter !== "converted") {
                where.AND.push({ convertedOrderId: null });
            }

            // Cart-only rows (no name, no phone) cannot be acted on.
            where.AND.push({
                OR: [{ name: { not: null } }, { phone: { not: null } }],
            });
        }

        if (where.AND.length === 0) {
            delete where.AND;
        }

        const [checkouts, total] = await Promise.all([
            prisma.abandonedCheckout.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
            }),
            prisma.abandonedCheckout.count({ where }),
        ]);

        // Thumbnails for the cart lines: one query for every product on this
        // page. Never fatal - the table simply falls back to a placeholder.
        const productIds = [
            ...new Set(
                checkouts.flatMap((checkout) =>
                    Array.isArray(checkout.cartItems)
                        ? checkout.cartItems
                              .map((item) => Number(item?.productId))
                              .filter((id) => Number.isInteger(id) && id > 0)
                        : []
                )
            ),
        ];

        let imageMap = new Map();

        if (productIds.length > 0) {
            try {
                const images = await prisma.productImage.findMany({
                    where: { productId: { in: productIds } },
                    select: { productId: true, imageUrl: true, isPrimary: true },
                    orderBy: { id: "asc" },
                });

                for (const image of images) {
                    if (!imageMap.has(image.productId) || image.isPrimary) {
                        imageMap.set(image.productId, image.imageUrl);
                    }
                }
            } catch (imageError) {
                console.error("Abandoned checkout image lookup failed:", imageError);
            }
        }

        const totalPages = Math.ceil(total / perPage);

        return Response.json({
            success: true,
            message: "Abandoned checkouts loaded.",
            data: checkouts.map((checkout) => formatCheckout(checkout, imageMap)),
            meta: {
                current_page: page,
                per_page: perPage,
                total,
                total_pages: totalPages,
                has_more: page < totalPages,
                from: total > 0 ? skip + 1 : 0,
                to: Math.min(skip + perPage, total),
            },
        });
    } catch (error) {
        console.error("Abandoned checkouts API error:", error);

        return Response.json(
            { success: false, message: "Failed to load abandoned checkouts." },
            { status: 500 }
        );
    }
}