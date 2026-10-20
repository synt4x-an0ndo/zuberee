import { cookies } from "next/headers";
import prisma from "../directory/prisma/prisma.js";
import { CART_COOKIE_NAME } from "./cart.js";

/**
 * Abandoned-checkout tracking.
 *
 * One row per cart, resolved identically from every entry point (add-to-cart,
 * checkout form, order placement) so a cart that later becomes an order can
 * always be matched back to the row that was opened when it was abandoned.
 *
 * Hard rules:
 *   - Nothing here may ever throw. Abandonment tracking is best-effort and must
 *     never break add-to-cart, checkout or order placement.
 *   - No contact detail is ever inferred, guessed or synthesised. A field is
 *     only written when the shopper (or an admin) actually supplied it.
 *   - Tracking never creates an order.
 */

/** Rows that are finished and must never be reused for a fresh cart. */
const CLOSED_STATUSES = ["converted", "cancelled"];

/** Fields that may be written, and only when an explicit value is supplied. */
const WRITABLE_FIELDS = ["cartItems", "name", "phone", "email", "address", "district"];

function isOpen(row) {
    return Boolean(row) && row.convertedOrderId === null && !CLOSED_STATUSES.includes(row.status);
}

/**
 * Find the row this cart should use.
 *
 * Signed-in shoppers are matched by user first, so the same account never
 * accumulates one row per device. A guest row created before sign-in is
 * adopted (its userId is attached) rather than duplicated.
 */
/**
 * Find the row this cart should use, plus any row that must be folded into it.
 *
 * Signed-in shoppers are matched by account first, so one account never
 * accumulates a row per device. When the account already owns an open row and
 * the current browser also has a guest row, the guest row is merged in and
 * deleted - otherwise it would linger as an orphan. When the account has no row
 * yet, the guest row is adopted by attaching the userId.
 */
async function resolveTarget({ sessionId, userId }) {
    const sessionRow = sessionId
        ? await prisma.abandonedCheckout.findUnique({ where: { sessionId } })
        : null;
    const sessionOpen = isOpen(sessionRow) ? sessionRow : null;

    if (!userId) return { target: sessionOpen, mergeFrom: null };

    const byUser = await prisma.abandonedCheckout.findFirst({
        where: {
            userId,
            convertedOrderId: null,
            status: { notIn: CLOSED_STATUSES },
        },
        orderBy: { updatedAt: "desc" },
    });

    // The account's open row is the one this browser already owns.
    if (byUser && sessionOpen && byUser.id === sessionOpen.id) {
        return { target: byUser, mergeFrom: null };
    }

    // Signed in here, but the account already has an open row elsewhere:
    // fold this browser's guest row into it and drop the orphan.
    if (byUser) {
        return { target: byUser, mergeFrom: sessionOpen };
    }

    // No row for the account yet - adopt the guest one instead of duplicating.
    return { target: sessionOpen, mergeFrom: null };
}

/**
 * The key for a guest cart: the same httpOnly cookie the cart itself uses, so
 * the server can resolve it from any route without help from the browser.
 * `fallback` only applies when that cookie is unavailable (cookies blocked, or
 * a client that still sends its own generated id).
 */
export async function resolveAbandonedSessionId(request, fallback = null) {
    try {
        const store = await cookies();
        const fromCookie = store.get(CART_COOKIE_NAME)?.value;

        if (fromCookie) return fromCookie;
    } catch {
        /* no cookie store in this context */
    }

    return fallback || null;
}

/**
 * Create or update the row for a cart.
 *
 * data          - any of WRITABLE_FIELDS; null/undefined values are ignored so a
 *                 later update can never erase details already captured.
 * createIfMissing - false when closing a loop (order placed) so a completed
 *                 checkout is never resurrected as a new pending row.
 * orderId       - when set, closes the row: isRecovered, status "converted",
 *                 convertedOrderId, convertedAt.
 */
export async function syncAbandonedCheckout({
    sessionId = null,
    userId = null,
    data = {},
    createIfMissing = true,
    orderId = null,
}) {
    try {
        const { target, mergeFrom } = await resolveTarget({ sessionId, userId });

        if (target) {
            const patch = {};

            for (const field of WRITABLE_FIELDS) {
                const incoming = data[field];

                // Incoming values win; otherwise keep whatever the row being
                // folded in already captured (never overwriting with null).
                const value =
                    incoming !== undefined && incoming !== null
                        ? incoming
                        : mergeFrom
                          ? mergeFrom[field]
                          : null;

                if (value !== undefined && value !== null) patch[field] = value;
            }

            if (userId && target.userId !== userId) patch.userId = userId;

            if (orderId) {
                patch.isRecovered = true;
                patch.status = "converted";
                patch.convertedOrderId = orderId;
                patch.convertedAt = new Date();
            }

            if (Object.keys(patch).length === 0) return target;

            const updated = await prisma.abandonedCheckout.update({
                where: { id: target.id },
                data: patch,
            });

            if (mergeFrom) {
                await prisma.abandonedCheckout.delete({
                    where: { id: mergeFrom.id },
                });
            }

            return updated;
        }

        if (!createIfMissing) return null;

        // Never open a row for an empty cart: there is nothing to recover.
        if (!Array.isArray(data.cartItems) || data.cartItems.length === 0) return null;

        return await prisma.abandonedCheckout.create({
            data: {
                sessionId: sessionId || null,
                userId: userId || null,
                cartItems: data.cartItems,
                name: data.name ?? null,
                phone: data.phone ?? null,
                email: data.email ?? null,
                address: data.address ?? null,
                district: data.district ?? null,
                status: "pending",
            },
        });
    } catch (error) {
        console.error("Abandoned checkout sync failed:", error);

        return null;
    }
}

/**
 * Snapshot of a cart's lines, priced the same way the checkout prices them.
 * Only quantities and prices are stored - no contact details are invented here.
 */
export async function buildCartSnapshot(cartId) {
    try {
        const items = await prisma.cartItem.findMany({
            where: { cartId },
            include: {
                product: { select: { name: true, price: true, discount: true } },
            },
        });

        return items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            title: item.product?.name ?? "Product",
            quantity: item.quantity,
            unitPrice: Number(
                item.product?.discount ?? item.product?.price ?? 0
            ),
        }));
    } catch (error) {
        console.error("Cart snapshot failed:", error);

        return [];
    }
}
