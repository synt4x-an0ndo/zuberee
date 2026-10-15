/**
 * Shared invoice maths for the admin order invoice page + invoice PDF.
 *
 * Input: one order in the shape returned by `GET api/admin/orders/:id`
 * (the same shape the order-detail page already reads). Both the on-screen
 * invoice and the downloadable PDF build from this one normaliser, so the
 * two can never disagree about totals.
 */

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** jsPDF's built-in fonts are WinAnsi — transliterate common symbols. */
export function sanitizePdfText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/৳/g, "BDT")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1,390.00" — grouped, always two decimals, as on a printed invoice. */
export function invoiceMoney(value) {
  const n = num(value);
  const [whole, fraction] = Math.abs(n).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}.${fraction}`;
}

export function getInvoiceData(order = {}) {
  const rawItems = Array.isArray(order.order_items) ? order.order_items : Array.isArray(order.items) ? order.items : [];

  const items = rawItems.map((item, index) => {
    const qty = num(item.qty ?? item.quantity, 1);
    const unitPrice = num(item.unitPrice ?? item.unit_price ?? item.price);
    const total = num(item.totalPrice ?? item.subtotal ?? item.total, unitPrice * qty);
    return {
      key: item.id ?? `${index}-${item.product_id ?? item.title ?? "item"}`,
      productId: item.product_id ?? item.productId ?? null,
      title: item.title || item.name || item.product?.name || "Product",
      sku: item.sku || item.product?.sku || "",
      variant: [item.color_name || item.color, item.size || item.selected_size || item.variant].filter(Boolean).join(" / "),
      size: item.size || item.selected_size || "",
      qty,
      unitPrice,
      total,
    };
  });

  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
  // The API's subtotal is authoritative (total - shipping). Any gap vs the
  // line items is a discount/adjustment and is shown as its own invoice row.
  const subtotal = order.subtotal !== undefined && order.subtotal !== null ? num(order.subtotal) : itemsTotal;
  const shipping = num(order.shipping_cost ?? order.shipping_fee);
  const advance = num(order.advance_payment);
  const total = order.total !== undefined && order.total !== null ? num(order.total) : subtotal + shipping;
  const adjustment = Math.round((subtotal - itemsTotal) * 100) / 100;

  const paymentStatus = String(order.payment_status || order.paymentStatus || "").toLowerCase();

  return {
    id: order.id,
    number: order.order_number || order.orderNumber || (order.id ? `ORD-${String(order.id).padStart(5, "0")}` : "ORD-00000"),
    createdAt: order.created_at || order.createdAt || null,
    updatedAt: order.updated_at || order.updatedAt || null,
    status: String(order.status || "").toLowerCase(),
    paymentStatus,
    paymentMethod: order.payment_method || "cash",
    customer: {
      name: order.name || order.guest?.name || "Guest",
      phone: order.phone || order.guest?.phone || "",
      email: order.email || "",
      address: order.address || order.shipping_address || "",
      district: order.district || "",
      type: order.customer_type || "",
    },
    deliveryNotes: order.delivery_notes || "",
    courier: typeof order.courier_entry === "string" ? order.courier_entry : "",
    items,
    itemsTotal,
    subtotal,
    adjustment,
    shipping,
    advance,
    total,
    // A settled order owes nothing: "paid" (or "refunded") means the full
    // total is covered even when no separate advance was recorded.
    totalDue: paymentStatus === "paid" || paymentStatus === "refunded" ? 0 : Math.max(0, total - advance),
    amountPaid: paymentStatus === "paid" ? total : advance,
  };
}
