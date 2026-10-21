# Order API contract

This document describes the order fields and validation implemented by the
storefront/admin frontend and backend. It is no longer a list of pending
backend work: the extended admin order update described below is implemented
by `PATCH /api/admin/orders/:id`.

## Mandatory customer contact on new orders

Every order-creation path requires:

- a customer name;
- a valid Bangladeshi mobile number matching `01[3-9]XXXXXXXX` after
  normalising an optional `880` country code; and
- a syntactically valid email address (stored trimmed and lower-case).

The frontend blocks submission before calling the API, and the backend
independently returns `400` before creating an order or changing stock.

### `POST /api/orders` (storefront)

The checkout sends the legacy guest names plus explicit contact-snapshot
aliases:

```jsonc
{
  "guestName": "Customer Name",
  "guestPhone": "01712345678",
  "guestEmail": "customer@example.com", // guest checkout
  "contactName": "Customer Name",
  "contactPhone": "01712345678",
  "contactEmail": "customer@example.com",
  "phone": "01712345678",
  "email": "customer@example.com",
  "guestAddress": "House, road, area, Dhaka",
  "district": "dhaka",
  "shippingFee": 80,
  "advancePayment": 0,
  "paymentMethod": "cash"
}
```

For an authenticated shopper, missing contact fields may fall back to the
selected saved address (name/phone) and account profile (name/phone/email),
but the final phone and email are still validated. The order stores:

- `guestName` / `guestPhone` for guest orders (existing aggregation fields);
- `contactName` / `contactPhone` / `contactEmail` for both guest and account
  orders.

Email is intentionally **not** added to the public order-detail response.
Admin order responses expose it as `email`.

### `POST /api/admin/orders` (manual admin order)

The admin Create Order form uses the same validation and sends
`guestEmail`/`contactEmail`/`email` in addition to the existing name and phone
fields. If `userId` is supplied to the API, explicit contact values win;
otherwise the linked user's profile values are used and then validated.

## Admin order reads

`GET /api/admin/orders/:id` and the admin order list return the effective
order contact snapshot, falling back to the linked user or legacy guest
fields for older rows:

```jsonc
{
  "id": 12,
  "order_number": "ORD-00012",
  "name": "Customer Name",
  "phone": "01712345678",
  "email": "customer@example.com",
  "address": "Luxmibazar, Sutrapur, Dhaka",
  "district": "Dhaka",
  "status": "confirmed",
  "payment_status": "paid",
  "payment_method": "cash",
  "courier_entry": "pathao",      // always a string; "" means none
  "delivery_notes": "Call first", // always a string
  "shipping_cost": 80,
  "subtotal": 1390,
  "total": 1470,
  "advance_payment": 0,
  "order_items": [
    {
      "id": 501,
      "product_id": 42,
      "product_variant_id": 9,
      "size": "38",
      "qty": 1,
      "unitPrice": 1390
    }
  ]
}
```

New order lines persist `OrderItem.variantId` and a printable `size`
snapshot. Older lines may have `variantId: null`; stock handling for those
lines falls back to the stock-movement ledger when it is unambiguous.

## Extended `PATCH /api/admin/orders/:id`

The order detail and Edit Order pages send one PATCH. All fields below are
optional at the API level; supplied fields are validated and persisted in one
transaction:

```jsonc
{
  "status": "CONFIRMED",
  "paymentStatus": "PAID",
  "courier_entry": "pathao",
  "name": "Customer Name",
  "phone": "01712345678",
  "email": "customer@example.com",
  "address": "Luxmibazar, Sutrapur, Dhaka",
  "district": "Dhaka",
  "payment_method": "cash",
  "shipping_cost": 80,
  "advance_payment": 0,
  "delivery_notes": "Call before delivery",
  "items": [
    { "id": 501, "product_id": 42, "variant_id": 9, "qty": 1, "unitPrice": 1390, "size": "38" },
    { "id": null, "product_id": 77, "qty": 2, "unitPrice": 990 }
  ]
}
```

Behaviour:

1. Customer edits update the order's contact snapshot. Guest orders also
   update `guestName`/`guestPhone` for existing reports. Editing an account
   order does **not** rename or change the linked login user.
2. A changed phone must be a valid Bangladeshi mobile number. On an existing
   order, email is not retroactively mandatory: an empty legacy email may
   remain empty, but a newly entered/changed non-empty email must be valid.
3. `items`, when present, replaces the order's item set: existing IDs update,
   `id: null` creates, and omitted existing IDs delete.
4. Totals are recalculated on the server as
   `Σ(qty × unitPrice) + shipping_cost`; `advance_payment` may not exceed the
   resulting total.
5. Item quantity changes on an active order adjust product/variant stock and
   write `sale`/`release` stock-movement rows. Quantity/product changes are
   rejected with `409` on cancelled/delivered orders and must be saved
   separately from a cancel/reactivate transition, preventing double stock
   movements.
6. `courier_entry` is persisted as the courier slug and returned as a string.
   This is courier assignment only; courier tracking IDs, ETA, current
   location and scan events remain covered by
   `COURIER_TRACKING_API_CONTRACT.md`.
7. The response uses the same shape as `GET /api/admin/orders/:id`, allowing
   the frontend to verify that every submitted section actually persisted.

## Pre-order behaviour

A product whose status is `PRE_ORDER` can be ordered beyond its current
physical stock. A size can also opt in independently with
`allow_preorder`; `preorder_limit` caps the number of units sold beyond
physical stock, while a null limit means no cap. Product and cart responses
expose the combined `order_capacity` (`null` when unlimited), so the
storefront does not disable a zero-stock pre-order size.

At order creation each line is split into a physical-stock portion and a
pre-order portion. Only the physical portion decrements stock and writes a
`sale` stock movement. The pre-order portion is stored as
`preorder_quantity` on the order item (with `is_preorder: true`) and, for a
variant line, increments `product_variants.preorderCount`. Cancelling or
deleting an active order releases the physical portion and removes its
pre-order count; reactivating it checks both again.

When an order with remaining `preorder_quantity` is moved to `SHIPPED` or
`DELIVERED`, the API first requires enough received stock, deducts that
stock with a `sale` movement, clears the remaining pre-order quantity, and
only then saves the status. If stock is still insufficient the PATCH is
rejected with `409` and no part of the update is saved.

## Database migration

`20261018214500_add_order_contact_and_extended_fields` adds:

- `orders.contactName`, `orders.contactPhone`, `orders.contactEmail`;
- `orders.courierEntry`, `orders.deliveryNotes`;
- `order_items.variantId` (FK to `product_variants`, `ON DELETE SET NULL`);
- `order_items.size`.

It backfills contact snapshots from guest fields or the linked user where
available. Legacy guest orders have no email to backfill.

`20261018233000_add_order_item_preorder_fields` adds
`order_items.isPreorder` and `order_items.preorderQuantity` for the
pre-order allocation snapshot described above.

## Invoice

No separate invoice API is required. The invoice page and PDF use the admin
order response above, including the now-persisted email, courier assignment,
delivery notes, item variant and size.
