# Backend Implementation Guide

This document is the integration contract for the backend used by this Next.js frontend. Implement the API routes and response shapes below so the existing frontend works without frontend changes.

The frontend does not contain demo content and does not create a backend. `NEXT_PUBLIC_API_BASE_URL` is intentionally empty by default. When no backend URL is configured or the backend cannot be reached, storefront routes show neutral skeleton placeholders and no site name, text, image, product, category, or contact data.

## 1. Run and connect the frontend

From the frontend directory:

```bash
npm install
npm run dev
```

The backend developer should set this value in `.env.local` when the API is ready:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```

The value must not have a trailing slash. The frontend calls paths such as `api/products`, so the backend base URL must serve those paths under the same host.

Required server configuration:

- Enable CORS for the frontend origin.
- Allow `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`.
- Allow request headers `Accept`, `Content-Type`, `Authorization`, `X-Session-ID`.
- Expose `Content-Disposition` for CSV downloads.
- Return JSON for API responses, except CSV export and file uploads.
- Use HTTPS in deployed environments.
- Return uploaded media as absolute URLs or paths such as `/storage/products/a.jpg` or `/uploads/products/a.jpg`.

## 2. Response and error rules

Success responses may be bare objects/arrays or use a `data` wrapper. The safest standard is:

```json
{ "message": "optional message", "data": {} }
```

Paginated responses should use:

```json
{
  "data": {
    "data": [],
    "current_page": 1,
    "last_page": 1,
    "per_page": 20,
    "total": 0,
    "from": null,
    "to": null
  }
}
```

The frontend also accepts a bare array for simple list endpoints.

Non-2xx responses should be JSON and use one of these shapes:

```json
{ "message": "Readable error" }
{ "error": "Readable error" }
{ "errors": { "email": ["The email is invalid."] } }
```

Use HTTP `401` for an expired/missing token, `403` for insufficient permission, `404` for missing records, `422` for validation errors, and `500` only for unexpected server failures.

## 3. Authentication and permissions

### Admin login

`POST api/admin/logIn` does not require authentication.

Request:

```json
{ "email": "admin@example.com", "password": "secret" }
```

Response:

```json
{
  "status": true,
  "token": "token-value",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "name": "Admin",
    "roles": ["super-admin"],
    "permissions": ["view products"]
  },
  "message": "Logged in"
}
```

For authenticated routes, accept:

```http
Authorization: Bearer <token>
```

Also implement:

- `POST api/logOut` - invalidate the bearer token.
- `GET api/me` - return `{ "user": { "id", "name", "roles", "permissions" } }`.

A `super-admin` bypasses permission checks. Other roles must be checked against the permission names listed below. The frontend stores the token in local storage and a cookie; the backend must still treat the bearer token as authoritative.

## 4. Public storefront API

All routes in this section are public and do not require a token.

### Site and navigation

`GET api/site-settings`

Return the site configuration used by the frontend:

```json
{
  "data": {
    "site_name": "Configured by admin",
    "primary_color": "#ff641f",
    "inventory_enforcement_enabled": false
  }
}
```

`GET api/frontend/categories`

Return a category tree. Each node should include:

```json
{
  "id": 12,
  "name": "Category name",
  "slug": "category-name",
  "parent_id": null,
  "home_category": true,
  "priority": 10,
  "size_guide_type": null,
  "track_inventory": false,
  "all_children": []
}
```

`GET api/product-slots_index/frontEndIndex?page=1`

Homepage sections:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Section name",
      "slug": "section-name",
      "products": []
    }
  ],
  "has_more": false
}
```

### Products

`GET api/shop/filters`

```json
{
  "data": {
    "categories": [],
    "sizes": [{ "id": 1, "size": "UK 6" }],
    "price_range": { "min": 0, "max": 0 }
  }
}
```

`GET api/shop/products?page=1`

Return a paginated product list.

`GET api/products?slug={slug}&page=1&sizes=&colors=&in_stock_only=1`

Return products for a category/collection. `slug` is required. `sizes` and `colors` may be repeated or comma-separated.

`GET api/category-filters/{slug}`

Return:

```json
{
  "data": {
    "category": { "id": 1, "name": "Category", "slug": "category" },
    "sizes": [{ "id": 1, "size": "UK 6", "available": true }],
    "colors": [{ "name": "Black", "code": "#000000", "image": null, "available": true }]
  }
}
```

`GET api/products/{id}`

Return a complete product:

```json
{
  "data": {
    "id": 1169,
    "title": "Product title",
    "sku": "SKU-1",
    "price": 1200,
    "discount": 1000,
    "status": "in-stock",
    "short_description": "...",
    "description": "<p>...</p>",
    "video_url": null,
    "images": [{ "image": "/storage/products/image.jpg" }],
    "colors": [{ "id": 1, "name": "Black", "code": "#000000", "image": null }],
    "sizes": [{ "id": 1, "size": "UK 6", "pivot": { "price": 1200, "stock": 5 } }],
    "category": [{ "id": 1, "name": "Category", "slug": "category" }],
    "inventory": {
      "track_inventory": true,
      "combinations": []
    },
    "product_colors": [],
    "specifications": [{ "key": "Material", "value": "Leather" }],
    "faqs": []
  }
}
```

`GET api/category-slug-products/{slug}?page=1` returns related products.

`GET api/product-search?q=term` returns `{ "data": [product] }`.

### CMS content, branding, and media

`GET api/about-us`

Return `{ "data": { "id", "title", "content", "image" } }`. `content` is HTML rendered by the frontend.

`GET api/pages/{slug}`

Implement these slugs:

- `privacy-policy`
- `return-policy`
- `size-guide`

Return `{ "id", "title", "content" }` or the same object under `data`.

`GET api/footer-settings`

Return the admin-managed branding/contact data:

```json
{
  "data": {
    "id": 1,
    "logo_path": "/storage/site/logo.png",
    "company_description": "...",
    "company_address": "...",
    "company_email": "...",
    "company_phone": "...",
    "shop_name": "..."
  }
}
```

`GET api/social-links-first`

Return `{ "data": { "facebook", "youtube", "instagram", "twitter", "tweeter", "pinterest", "facebook_id", "whatsapp_number" } }`.

`GET api/banners`

Return `{ "data": [{ "id", "image", "title", "link" }] }`. Banner and product image paths must point to backend-served media. Do not expect the frontend to provide fallback images.

`GET api/sizes`

Return `{ "data": [{ "id": 1, "size": "UK 6" }] }`.

### Cart, shipping, and orders

`GET api/shipping-costs-latest`

Return:

```json
{
  "data": {
    "shipping_type": "inside_outside",
    "inside_dhaka": 60,
    "outside_dhaka": 120,
    "one_shipping_cost": 80
  }
}
```

Checkout calls:

- `POST api/track-abandoned-checkout` with `X-Session-ID` and `{ name, phone, address, cart_items }`.
- `POST api/mark-checkout-converted` with `{ session_id, phone }`.
- `POST api/orders` with customer, shipping, cart, total, and optional tracking fields.

Order cart items use:

```json
{ "product_variant_id": 123, "qty": 2, "price": 1000 }
```

For stock conflicts return HTTP `422`:

```json
{ "shortfalls": [{ "title": "Product", "variant_label": "Black / UK 6", "available": 0 }] }
```

Analytics calls are best-effort:

- `POST api/track-view`
- `POST api/track-add-to-cart`

## 5. Admin API

All routes in this section require a bearer token and the listed permission.

### Dashboard

Permission: authenticated dashboard access.

`GET api/dashboard/summary?range=today|week|month|year|custom&hot_limit=7&status=&start_date=&end_date=`

Return totals, changes, sales trend, status breakdown, and top products:

```json
{
  "totals": { "gross_sales": 0, "orders": 0, "units_sold": 0, "customers": 0, "average_order_value": 0, "shipping_collected": 0 },
  "changes": {},
  "sales_trend": [],
  "status_breakdown": [],
  "top_products": []
}
```

### Categories

Permission: `view categories`.

- `GET api/categories?page=1&search=`
- `GET api/categories/{id}`
- `POST api/categories`
- `PUT api/categories/{id}`
- `DELETE api/categories/{id}`
- `GET api/frontend/categories`

Category create/update fields:

```json
{
  "name": "Category",
  "parent_id": null,
  "home_category": "1",
  "priority": 0,
  "size_guide_type": "shoe",
  "track_inventory": true,
  "apply_tracking_to_products": false
}
```

Validate `name` as required and max 100 characters. Validate `priority` from 0 to 999.

### Products and sizes

Permission: `view products` for product management, `view sizes` for sizes.

Products:

- `GET api/products?search=&status=&page=`
- `GET api/products/{id}`
- `POST api/products` as multipart form data
- `POST api/products/{id}` as multipart form data with `_method=PUT`
- `DELETE api/products/{id}`
- `GET api/product_add_category`
- `GET api/sizes`

Product multipart fields:

```text
title, sku, price, discount, status
short_description, description, video_url
colors[i][code], colors[i][name], colors[i][image]
sizes[i][size_id], sizes[i][price], sizes[i][stock]
categories[i][category_id]
image[]
faqs[i][question], faqs[i][answer]
specifications[i][key], specifications[i][value]
```

Sizes:

- `GET api/sizes`
- `POST api/sizes` with `{ "size": "UK 6" }`
- `GET api/sizes/{id}`
- `PUT api/sizes/{id}`
- `DELETE api/sizes/{id}`

### Inventory

Permission: `manage inventory`.

- `GET api/inventory/summary`
- `GET api/inventory/variants?page=&per_page=&search=&tracked=1`
- `GET api/inventory/products`
- `GET api/inventory/sizes`
- `GET api/inventory/products/{id}/matrix`
- `PUT api/inventory/products/{id}/matrix`
- `POST api/inventory/stock-in`
- `POST api/inventory/adjust`
- `GET api/inventory/movements?page=&per_page=40&type=&start_date=&end_date=`
- `PUT api/site-settings` with `{ "inventory_enforcement_enabled": true }`

Stock-in body:

```json
{ "note": "Purchase reference", "lines": [{ "product_variant_id": 1, "qty": 5, "unit_cost": 100 }] }
```

Adjustment body:

```json
{ "product_variant_id": 1, "stock": 5, "type": "adjustment", "note": "Reason" }
```

### Orders and checkout administration

Permission: `view orders`.

- `GET api/orders?page=&status=&from=&to=&search=`
- `GET api/orders/{id}`
- `PUT api/orders/{id}`
- `POST api/order_status/{id}` with `{ status, userPhone }`
- `GET api/order-product-options`
- `POST api/orders/{id}/courier-check`
- `POST api/pathao/orders/{id}/create`
- `GET api/orders-download-csv?<same filters>`
- `GET api/footer-settings/1` for invoice branding
- `GET api/abandoned-checkouts?page=&start_date=&end_date=&status=`
- `PUT api/dashboard/abandoned-checkouts/{id}/status`
- `POST api/dashboard/abandoned-checkouts/{id}/convert`

Use these exact order statuses:

```text
Pending, Completed, Placed, Cancelled, Processing, Returned,
1st Call Done, 2nd Call Done, 3rd Call Done, Stock Sold,
Shipped To You, Received In BD, Order Sent To China,
File Completed, Order Confirmed
```

### Customers and reports

Customers:

- `GET api/customer-profiles?search=&badge=&page=`
- `GET api/customer-profiles/{id}`
- `PUT api/customer-profiles/{id}`
- `GET api/customers/leaderboard?page=&search=&district=&per_page=`
- `GET api/customers/statistics`
- `GET api/customers/{phone}`
- `POST api/customer-profiles/assign-badge`

Reports:

- `GET api/sales-report?from=&to=&status=&search=&sort=revenue`

Sales report should return `summary`, `products`, and `status_breakdown` arrays/objects.

### Shipping, banners, and settings

Shipping permission: `view settings`.

- `GET api/shipping-costs`
- `POST api/shipping-costs`

Banners permission: `view banners`.

- `GET api/banners`
- `POST api/banners` multipart
- `POST api/banners/{id}` multipart with `_method=PUT`
- `DELETE api/banners/{id}`

Settings permission: `view settings`.

- About Us: `GET api/about-us`, `PUT api/about-us/{id}` or multipart `POST` with `_method=PUT`.
- Footer: `GET api/footer-settings`, `PUT api/footer-settings/{id}`; use multipart when changing the logo.
- Theme: `GET api/site-settings`, `PUT api/site-settings` with `{ "primary_color": "#ff641f" }`.
- Social links: `GET api/social-links`, `POST api/social-links`, `PUT api/social-links/{id}`.
- Facebook CAPI: `GET api/facebook-settings`, `POST api/facebook-settings`.
- Fraud checker: `GET/PUT api/fraud-checker/settings`, `POST api/fraud-checker/settings/test`, `GET api/fraud-checker/plan`.

Settings updates are patches. Merge the supplied fields instead of replacing the complete settings row.

### Users and roles

Role: `super-admin` only.

- `GET api/users`
- `POST api/users`
- `PUT api/users/{id}`
- `POST api/users/{id}/assign-role`
- `DELETE api/users/{id}`
- `GET api/roles`
- `GET api/permissions`
- `POST api/roles`
- `PUT api/roles/{id}`
- `DELETE api/roles/{id}`

`GET api/roles` must return a top-level `roles` key:

```json
{ "roles": [{ "id": 1, "name": "manager", "permissions": [{ "name": "view products" }] }] }
```

## 6. Admin-managed content checklist

Before connecting the frontend, the backend must provide admin CRUD for:

- Site name, theme color, and site feature settings.
- Logo and all uploaded images.
- Homepage banners and links.
- Categories, products, sizes, prices, discounts, variants, and stock.
- About Us, privacy policy, return policy, and size guide HTML.
- Footer description, address, email, phone, and shop name.
- Social links and WhatsApp number.
- Users, roles, and permissions.
- Orders, shipping rules, abandoned checkouts, customers, reports, and courier settings.

Do not seed frontend demo content as a substitute for these records. An empty database should result in empty API arrays/objects and the frontend skeleton placeholder.

## 7. Frontend route map

| Frontend route | Backend data |
|---|---|
| `/` | site settings, categories, homepage slots, banners, footer, social links |
| `/frontEnd/shop` | shop filters and shop products |
| `/frontEnd/{category}` | category products and filters |
| `/frontEnd/product-page/{id}` | product detail and related products |
| `/frontEnd/about_us` | About Us CMS record |
| `/frontEnd/privacy_policy` | `api/pages/privacy-policy` |
| `/frontEnd/return_policy` | `api/pages/return-policy` |
| `/size-guide` | `api/pages/size-guide` |
| `/frontEnd/admin` | admin login |
| `/dashboard/**` | authenticated admin APIs above |

## 8. Completion test

The backend is ready when all of the following work:

1. Configure `NEXT_PUBLIC_API_BASE_URL` and load `/`.
2. Site settings and footer data appear only after API success.
3. Homepage banners and product images load from backend media URLs.
4. Product, category, CMS, cart, checkout, and search requests return the shapes documented above.
5. Admin login returns a token and `/api/me` returns roles and permissions.
6. Every protected endpoint rejects missing/invalid tokens.
7. CRUD changes made in the admin panel appear in the storefront.
8. With the backend stopped, storefront routes still return `200` and show only the frontend skeleton placeholder.
