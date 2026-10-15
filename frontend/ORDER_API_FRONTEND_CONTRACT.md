# Order admin — frontend ⇄ backend contract

The admin **order detail**, **edit order** and **invoice** frontend is complete.
Everything below is what the frontend already sends/reads, so the backend dev
can implement persistence without any further frontend change.

## Already working (do not change)

- `GET  /api/admin/orders/:id` — order detail. Frontend reads:
  `id, order_number, name, phone, email?, address, district, status,
  payment_status, payment_method, shipping_cost, subtotal, total,
  advance_payment, customer_type, courier_entry?, delivery_notes?,
  created_at, updated_at, order_items[] / items[]`
  with items `{ id, product_id, title, sku, unitPrice, qty, totalPrice,
  colorImage?, color_name?, size? }`.
- `GET  /api/admin/orders/product-options` — `data: [{ id, title, sku }]`
  (used by the Edit page's "Add product" picker).
- `PATCH /api/admin/orders/:id` with `{ status, paymentStatus }`
  (uppercase enums) — status/payment editing already saves today.

## To implement: extended `PATCH /api/admin/orders/:id`

The Edit page sends **one** PATCH containing every edited field:

```jsonc
{
  // existing (already persisted)
  "status": "CONFIRMED",              // PENDING|CONFIRMED|PROCESSING|SHIPPED|DELIVERED|CANCELLED
  "paymentStatus": "PAID",            // PENDING|PAID|FAILED|REFUNDED

  // new fields to persist
  "courier_entry": "pathao",          // "" = none; slugs: pathao, redx, steadfast,
                                      // eCourier, sundarban, sa-paribahan, paperfly,
                                      // in-house, other  (free string is fine)
  "name": "Eahtasam",                 // guest name (registered users: see note)
  "phone": "01846836737",
  "email": "",
  "address": "Luxmibazar, Sutrapur, Dhaka",
  "district": "Dhaka",
  "payment_method": "cash",
  "shipping_cost": 80,
  "advance_payment": 0,
  "delivery_notes": "",
  "items": [
    { "id": 501, "product_id": 42, "qty": 1, "unitPrice": 1390, "size": "38" },
    { "id": null, "product_id": 77, "qty": 2, "unitPrice": 990 }   // id null = new line
  ]
}
```

Server responsibilities on save:

1. Validate like the create-order endpoint (products exist/active, qty ≥ 1).
2. Replace the order's item set with `items` (update rows with an `id`,
   create rows with `id: null`, delete rows that are missing), adjusting
   product/variant stock for quantity deltas where inventory is tracked.
3. Recompute: `subtotal = Σ qty × unitPrice`,
   `totalAmount = subtotal + shipping_cost` (ignore any client-sent total).
4. Persist `shippingFee = shipping_cost`, `advancePayment = advance_payment`,
   `paymentMethod`, `district`, `shippingAddress = address`,
   `delivery_notes`, and the courier slug (`courier_entry`, or a dedicated
   `courier` column returned under either name — the frontend reads
   `courier_entry` first).
5. Customer identity: for guest orders write `guestName/guestPhone`; for
   registered-user orders either ignore name/phone/email or update the linked
   user — but **return what was actually stored**, because the frontend
   compares the PATCH response with the form and honestly reports any field
   the API did not persist (it never fakes a save).
6. Return the same shape as `GET /api/admin/orders/:id`
   (`{ success: true, data: formatOrder(order) }`), including `courier_entry`
   and `delivery_notes` in `formatOrder`.

Until this lands, changing only customer/items/charges/courier in the UI
returns `400 "No valid fields to update."` (or saves status/payment only) —
the Edit page surfaces that message instead of pretending success.

## Invoice

No backend work needed. The invoice page (`/admin/orders/invoice/:id`) and the
invoice PDF are generated entirely in the frontend from the existing
`GET /api/admin/orders/:id` response.
