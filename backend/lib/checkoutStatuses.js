/**
 * Statuses an abandoned checkout can move through.
 *
 * Shared by every route that reads or writes `status`, so the admin dropdown
 * and the server-side validation can never drift apart.
 *
 * The column is a plain String, so adding a stage needs no migration - only
 * this list changes.
 *
 * The lifecycle that matters to tracking lives in lib/abandonedCheckout.js and
 * treats "converted" and "cancelled" as finished. The workflow stages below are
 * admin-facing labels: they never create or close anything on their own.
 */
export const CHECKOUT_STATUSES = [
    "pending",
    "completed",
    "placed",
    "cancelled",
    "processing",
    "returned",
    "first-call-done",
    "second-call-done",
    "third-call-done",
    "stock-sold",
    "shipped-to-you",
    "received-in-bd",
    "order-sent-to-china",
    "file-completed",
    "order-confirmed",
    "converted",
];

export function normalizeCheckoutStatus(value) {
    return String(value ?? "").trim().toLowerCase();
}

export function isValidCheckoutStatus(value) {
    return CHECKOUT_STATUSES.includes(normalizeCheckoutStatus(value));
}
