/**
 * Delivery fee handling.
 *
 * The backend has no public shipping-cost endpoint (admin-only), and it trusts the
 * shippingFee sent with an order. Until a public quote exists, fees come from optional
 * frontend env vars. When they are unset, checkout says the fee is confirmed on call
 * and sends 0.
 *
 *   NEXT_PUBLIC_SHIPPING_INSIDE_DHAKA=60
 *   NEXT_PUBLIC_SHIPPING_OUTSIDE_DHAKA=120
 */

function readFee(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const INSIDE = readFee(process.env.NEXT_PUBLIC_SHIPPING_INSIDE_DHAKA);
const OUTSIDE = readFee(process.env.NEXT_PUBLIC_SHIPPING_OUTSIDE_DHAKA);

/** Returns { fee: number | null, confirmed: boolean } for a district value such as "dhaka". */
export function shippingQuote(district) {
  if (!district) return { fee: null, confirmed: false };
  const fee = district === "dhaka" ? INSIDE : OUTSIDE;
  return { fee, confirmed: fee !== null };
}
