# Courier tracking — frontend ⇄ backend contract

The public **Track your shipment** page (`/track-order`) is complete on the
frontend. It works today with the existing order endpoint and automatically
upgrades when the backend returns real courier/shipment fields.

## What works today — no backend change required

Current data source:

```http
GET /api/orders/:id
```

The page already uses:

- `id`, `user_id`, `guest { name, phone }`
- `status`, `payment_status`
- `total_amount`, `shipping_fee`, `advance_payment`, `payment_method`
- `shipping_address`, `district`
- `courier_entry` (courier slug assigned in Admin Orders)
- `items[]`
- `created_at`, `updated_at`

Those fields drive the centred search, status banner, six-step progress,
derived timeline, destination and order summary. Signed-in users also get
recent-order shortcuts from the existing endpoint:

```http
GET /api/account/orders?page=1&per_page=5
```

## Current limitations

Courier assignment (`courier_entry`) is now persisted by the extended admin
order API. The current order record/API still has **no consignment/tracking
ID, ETA, current hub/location, status-history timestamps or courier scan
events**. Therefore the UI can name an assigned courier but otherwise honestly
displays “Courier details pending” instead of inventing shipment information.

> Privacy note: `GET /api/orders/:id` currently returns guest phone and the
> full shipping address without authentication. The frontend hides private
> details until the owner is signed in or the guest phone matches, but the
> network response itself is still exposed. The secure tracking endpoint
> below is the proper long-term fix.

## Minimum backend upgrade — add shipment fields to the order response

No provider integration is required for this first step. Persist the fields
below (manually entered by an admin is enough) and return them from:

- `GET /api/orders/:id`
- `GET /api/account/orders` and the single-order account response if one is added
- `GET /api/admin/orders/:id`
- `GET /api/admin/orders` (at least the courier/tracking summary fields)

### Preferred field names

Add these keys to the existing `data` order object:

```jsonc
{
  "courier_entry": "pathao",
  "courier_name": "Pathao Courier",
  "courier_tracking_id": "PTH-123456789",
  "courier_tracking_url": "https://provider.example/track/PTH-123456789",
  "shipment_status": "out_for_delivery",
  "current_location": "Gazipur delivery hub",
  "estimated_delivery_at": "2026-10-20T12:00:00+06:00",
  "shipped_at": "2026-10-18T15:30:00+06:00",
  "delivered_at": null,
  "cancelled_at": null,
  "tracking_updated_at": "2026-10-19T09:15:00+06:00",
  "tracking_events": [
    {
      "id": "provider-event-991",
      "status": "picked_up",
      "title": "Parcel picked up",
      "description": "The courier collected the parcel from Zuberee.",
      "location": "Dhaka hub",
      "occurred_at": "2026-10-18T15:30:00+06:00",
      "source": "Pathao Courier"
    },
    {
      "id": "provider-event-1042",
      "status": "out_for_delivery",
      "title": "Out for delivery",
      "description": "The delivery agent is on the way to the customer.",
      "location": "Gazipur",
      "occurred_at": "2026-10-19T09:15:00+06:00",
      "source": "Pathao Courier"
    }
  ]
}
```

Rules:

1. `courier_entry` must be a string slug or `""`; never return numeric `0`.
   Existing frontend slugs are in `frontend/lib/couriers.js`:
   `pathao`, `redx`, `steadfast`, `eCourier`, `sundarban`, `sa-paribahan`,
   `paperfly`, `in-house`, `other`. Unknown strings are displayed as-is.
2. All timestamps must be ISO 8601 with timezone.
3. `tracking_events` may be ascending or descending; the frontend sorts the
   activity feed newest-first. Event IDs should be stable/idempotent.
4. `shipment_status` should use one of:

   | Value | Meaning |
   |---|---|
   | `pending` | Order received, not confirmed |
   | `confirmed` | Confirmed by the shop |
   | `processing` | Being prepared/packed |
   | `shipped` or `in_transit` | Picked up / moving through courier network |
   | `out_for_delivery` | Delivery agent is on the way |
   | `delivered` | Delivered |
   | `cancelled` | Cancelled |
   | `delivery_failed` | A delivery attempt failed |
   | `returned` | Returned to sender |
   | `on_hold` | Held/delayed by courier |

5. Only return a full address, item details, tracking ID and provider URL in a
   public response after ownership is verified (see secure endpoint below).

### Field aliases the frontend already accepts

The preferred names above are best, but `frontend/lib/orderTracking.js`
already accepts these alternatives, including the same fields nested under a
`shipment`, `tracking` or `delivery` object:

- Courier: `courier_entry`, `courierEntry`, `courier_name`, `courierName`,
  `courier_slug`, `courierSlug`, `courier`, `delivery_partner`, `provider`
- Tracking ID: `tracking_id`, `trackingId`, `tracking_number`,
  `trackingNumber`, `consignment_id`, `consignmentId`, `consignment_number`,
  `awb`, `waybill`, `courier_tracking_id`, `courierTrackingId`
- Tracking URL: `tracking_url`, `trackingUrl`, `courier_tracking_url`,
  `courierTrackingUrl`, `url`, `link` (inside shipment/tracking)
- ETA: `estimated_delivery_at`, `estimatedDeliveryAt`,
  `expected_delivery_at`, `expectedDeliveryAt`, `delivery_eta`, `eta`
- Shipment status: `shipment_status`, `shipmentStatus`, `delivery_status`,
  `deliveryStatus`, `courier_status`, `courierStatus`, `status`
  (inside shipment/tracking)
- Events: `tracking_events`, `trackingEvents`, `status_history`,
  `statusHistory`, `timeline`, `events`, `history`
- Step times: `confirmed_at`, `processing_at`/`packed_at`, `shipped_at`/
  `picked_up_at`/`dispatched_at`, `out_for_delivery_at`, `delivered_at`,
  `cancelled_at`

## Recommended secure public tracking endpoint

Add this when ready; the frontend call can then be switched from the public
order GET to this endpoint without changing the tracking UI/model:

```http
POST /api/orders/track
Content-Type: application/json
Authorization: Bearer <token>   (optional)
```

Request:

```json
{
  "order_number": "ORD-00008",
  "phone": "01838134612"
}
```

Also accept `order_id` as an alias for `order_number`.

Behaviour:

1. Normalize `ORD-00008`, `ord-8` and `8` to the numeric order ID.
2. Mark the response as verified when either:
   - the bearer user owns the order, or
   - the normalized Bangladeshi phone matches the guest phone **or** the
     account/order delivery phone stored server-side.
3. If the order cannot be found, return a generic `404`:
   `{ "success": false, "message": "Order not found.", "data": null }`.
   Do not reveal whether the phone exists.
4. For an unverified but existing order, either return the same generic `404`
   (safest) or a deliberately limited object containing only order number,
   internal status, placed/last-updated timestamps, district, item/unit count
   and non-sensitive timeline titles/times. **Never** return full address,
   guest/account phone, item names/prices, tracking ID or provider URL.
5. Rate-limit by IP + order number and never accept the phone in a query
   string (URLs are commonly logged).

Verified response: return the same order fields as the current
`GET /api/orders/:id`, plus the preferred shipment fields above and:

```json
{
  "success": true,
  "message": "Tracking loaded.",
  "data": {
    "verification": "verified"
  }
}
```

For a limited response use `"verification": "limited"`.

### Optional lookup by courier tracking ID

```http
POST /api/tracking/lookup
```

```json
{
  "tracking_id": "PTH-123456789",
  "phone": "01838134612"
}
```

Return exactly the same verified/limited shape as `POST /api/orders/track`.

## Admin APIs needed to save shipment data

Either extend the existing order PATCH or add dedicated shipment endpoints.

### Option A — extend the existing order PATCH (smallest change)

`PATCH /api/admin/orders/:id` should additionally accept and persist:

```json
{
  "courier_entry": "pathao",
  "courier_name": "Pathao Courier",
  "courier_tracking_id": "PTH-123456789",
  "courier_tracking_url": "https://provider.example/track/PTH-123456789",
  "shipment_status": "shipped",
  "current_location": "Dhaka hub",
  "estimated_delivery_at": "2026-10-20T12:00:00+06:00"
}
```

Server side effects:

- When status becomes `SHIPPED`, set `shipped_at` if empty.
- When status becomes `DELIVERED`, set `delivered_at` if empty.
- When status becomes `CANCELLED`, set `cancelled_at` if empty.
- Create a tracking event for each internal status transition.
- Return the full updated order in the same shape as
  `GET /api/admin/orders/:id`, including every shipment field actually stored.

### Option B — dedicated shipment endpoints (cleaner for providers)

```http
PUT    /api/admin/orders/:id/shipment
POST   /api/admin/orders/:id/tracking-events
DELETE /api/admin/orders/:id/tracking-events/:eventId   (optional)
POST   /api/admin/orders/:id/shipment/sync              (provider phase)
```

Require admin authentication plus an existing order-edit permission
(`edit orders` or `order_status`). `PUT .../shipment` accepts the same JSON
as Option A. `POST .../tracking-events` accepts one event object using the
event fields above and returns the updated order/shipment.

## Provider integration phase (later)

Only backend/server code should hold courier credentials. Never call Pathao,
RedX, Steadfast, etc. directly from the browser and never reuse the existing
fraud/courier-history checker as shipment tracking.

Suggested endpoints:

```http
POST /api/admin/orders/:id/shipment/create-consignment
POST /api/admin/orders/:id/shipment/sync
POST /api/couriers/:provider/webhook
```

Responsibilities:

1. Create the provider consignment from the stored order/address.
2. Persist provider slug, consignment/tracking ID, provider tracking URL,
   raw provider status, normalized `shipment_status`, ETA and sync time.
3. Convert provider scans into idempotent `tracking_events` (unique provider
   event ID where available; otherwise order ID + status + occurred-at).
4. Verify webhook signatures/secrets, accept duplicate webhooks safely, and
   map provider statuses to the normalized values in the table above.
5. Keep internal order status in sync: pickup/in-transit → `SHIPPED`,
   delivered → `DELIVERED` (+ existing payment/stock rules), cancelled/returned
   according to the shop's business policy.

## Suggested database shape

Minimal approach:

- Add nullable shipment columns to `orders`:
  `courierEntry`, `courierName`, `courierTrackingId`, `courierTrackingUrl`,
  `shipmentStatus`, `currentLocation`, `estimatedDeliveryAt`, `shippedAt`,
  `deliveredAt`, `cancelledAt`, `trackingUpdatedAt`.
- Add an `OrderTrackingEvent` table:
  `id`, `orderId`, `provider`, `providerEventId?`, `status`, `title`,
  `description?`, `location?`, `occurredAt`, `source`, `createdAt`.
- Index `orderId + occurredAt`; unique-index
  `provider + providerEventId` when `providerEventId` is present.

## Definition of done for the backend phase

- A guest can track with order number + matching phone and see courier,
  tracking ID, ETA and scan timeline.
- A signed-in owner can track without re-entering their phone.
- A wrong phone/non-owner cannot read the address, phone, items or tracking ID
  from the network response.
- Admin can save courier + tracking ID once and every order response returns
  the stored values.
- Status changes create timeline events with real transition timestamps.
- Provider webhooks/sync update the same fields without duplicate events.
