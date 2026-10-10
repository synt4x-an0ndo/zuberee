/**
 * =========================================================================
 * Order response adapter
 * =========================================================================
 * The backend Order API (see readme_frontend.txt) returns this shape for
 * both `GET /api/orders` and `GET /api/orders/:id`:
 *
 *   {
 *     id, user_id,
 *     guest: { name, phone } | null,     // guest orders only
 *     status,                            // lowercase, e.g. "pending"
 *     payment_status,                    // lowercase, e.g. "pending"
 *     total_amount, shipping_fee, shipping_address,
 *     items: [{ id, product_id, title, sku, unit_price, quantity, subtotal }],
 *     created_at, updated_at
 *   }
 *
 * The admin UI was written against a different (richer) contract, so this
 * adapter maps the documented response onto the field names the UI already
 * reads. Fields the documented API does NOT provide fall back to safe
 * defaults so the UI degrades gracefully instead of showing `undefined`.
 */

const asArray = (value) =>
  Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

/** Normalize a single order line item to the shape the UI expects. */
export function normalizeOrderItem(it = {}) {
  const unitPrice = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0) || 0;
  const qty = Number(it.quantity ?? it.qty ?? 1) || 0;
  const total = Number(it.subtotal ?? it.totalPrice ?? it.total ?? unitPrice * qty) || 0;
  const color = it.color_name ?? it.color ?? null;
  return {
    id: it.id,
    product_id: it.product_id ?? it.productId ?? null,
    title: it.title ?? it.product?.name ?? it.name ?? "Product",
    sku: it.sku ?? null,
    // Money / qty under the legacy names the UI reads:
    unitPrice,
    price: unitPrice,
    qty,
    totalPrice: total,
    total,
    // Variant / colour are NOT returned by the documented order API;
    // kept for UI compatibility with safe null fallbacks.
    color,
    color_name: color,
    size: it.size ?? it.size_label ?? null,
    size_id: it.size_id ?? null,
  };
}

/**
 * Adapt a documented Order API response into the shape the admin UI reads.
 * Passing an already-normalized order through again is safe (idempotent).
 */
export function normalizeOrder(o = {}) {
  const guest = o.guest && typeof o.guest === "object" ? o.guest : null;
  const items = asArray(o.items ?? o.order_items ?? o.cart_items);

  const shippingFee = Number(o.shipping_fee ?? o.shipping_cost ?? 0) || 0;
  const totalAmount = Number(o.total_amount ?? o.total ?? 0) || 0;

  return {
    ...o, // preserve any additional fields the API may include
    id: o.id,

    // Customer — only guest orders carry name/phone in this response.
    name: o.name ?? guest?.name ?? "",
    phone: o.phone ?? guest?.phone ?? "",
    email: o.email ?? "",

    // Address — the API returns one combined string.
    address: o.address ?? o.shipping_address ?? "",
    district: o.district ?? "", // not provided by the documented API

    // Money.
    shipping_cost: o.shipping_cost ?? shippingFee,
    shipping_fee: shippingFee,
    total_amount: totalAmount,
    total: o.total ?? totalAmount,
    advance_payment: o.advance_payment ?? 0, // not provided by the documented API

    // Misc — not provided by the documented API; sensible fallbacks only.
    payment_method: o.payment_method ?? "cash",
    delivery_notes: o.delivery_notes ?? "",

    // Status (API returns lowercase; UI uppercases where needed).
    status: o.status,
    payment_status: o.payment_status ?? o.paymentStatus,

    items: items.map(normalizeOrderItem),
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

/** Convenience: normalize a list of orders coming from `GET /api/orders`. */
export function normalizeOrders(list) {
  return asArray(list).map(normalizeOrder);
}
