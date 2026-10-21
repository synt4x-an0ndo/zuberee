/**
 * Delivery fee handling.
 *
 * Rates are managed in Admin -> Shipping costs and exposed publicly by
 * `GET api/shipping-costs`; checkout quotes from those live rates (a flat
 * rate, when set, applies to every district). The orders API recomputes
 * the same fee server-side when the order is placed. Optional env vars
 * remain as an offline fallback; when no fee is known at all, checkout
 * says the fee is confirmed on call and sends 0.
 *
 *   NEXT_PUBLIC_SHIPPING_INSIDE_DHAKA=60
 *   NEXT_PUBLIC_SHIPPING_OUTSIDE_DHAKA=120
 */

import { api } from "@/lib/api";

function readFee(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const INSIDE = readFee(process.env.NEXT_PUBLIC_SHIPPING_INSIDE_DHAKA);
const OUTSIDE = readFee(process.env.NEXT_PUBLIC_SHIPPING_OUTSIDE_DHAKA);

let ratesPromise = null;

/**
 * Latest admin shipping rates: { inside, outside, flat } (numbers or null).
 * Fetched once per page session; resolves to null when unavailable.
 */
export function fetchShippingRates() {
  if (!ratesPromise) {
    ratesPromise = api
      .get("api/shipping-costs", { auth: false })
      .then((body) => {
        const data = body?.data || body || {};
        const rates = {
          inside: readFee(data.inside_dhaka ?? data.insideDhaka),
          outside: readFee(data.outside_dhaka ?? data.outsideDhaka),
          flat: readFee(data.one_shipping_cost ?? data.oneShippingCost),
        };
        return rates.inside !== null || rates.outside !== null || rates.flat !== null ? rates : null;
      })
      .catch(() => null);
  }
  return ratesPromise;
}

/** Returns { fee: number | null, confirmed: boolean } for a district value such as "dhaka". */
export function shippingQuote(district, rates = null) {
  if (!district) return { fee: null, confirmed: false };
  const flat = rates ? rates.flat : null;
  if (flat !== null && flat !== undefined) return { fee: flat, confirmed: true };
  const inside = rates ? rates.inside : INSIDE;
  const outside = rates ? rates.outside : OUTSIDE;
  const fee = district === "dhaka" ? (inside ?? INSIDE) : (outside ?? OUTSIDE);
  return { fee, confirmed: fee !== null };
}
