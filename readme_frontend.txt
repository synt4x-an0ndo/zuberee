Register API → Frontend Integration
- API endpoint: POST /api/auth/register
- Request fields: name, email, password, confirmPassword
- Success response: success, message, data
- Error handling: Display the API message on the frontend
- Backend URL: http://localhost:3001
- Frontend API call: fetch() / API service function
- Success action: Redirect to the Login page

Login API → Frontend Integration
- API endpoint: POST /api/auth/login
- Request fields: email, password
- Success response: success, message, data
- Response data: token, user
- Error handling: Display the API message on the frontend
- Backend URL: http://localhost:3001
- Frontend API call: fetch() / API service function
- Success action: Store the JWT token and redirect to the Dashboard/Home page

JWT Authentication Middleware
- Authentication helper: authenticateRequest()
- Authorization header: Bearer JWT token
- Token verification: Verify the JWT token
- Valid token: Extract userId, email, and role
- Invalid/expired token: Return 401 Unauthorized
- Protected APIs: Require a valid JWT token
- Reusable authentication: Use the same helper across all protected APIs

Get Authenticated User API
- API endpoint: GET /api/auth/me
- Authentication: JWT required
- Authorization header: Bearer JWT token
- Token validation: Verify using authenticateRequest()
- Success response: success, message, data
- Response data: userId, email, role
- Invalid/missing token: Return 401 Unauthorized

Logout API
- API endpoint: POST /api/auth/logout
- Authentication: JWT required
- Authorization header: Bearer JWT token
- Token validation: Verify using authenticateRequest()
- Success response: success, message, data
- Success message: Logout successful.
- Invalid/missing token: Return 401 Unauthorized
- Actual logout: Remove the JWT token on the client side

Category API
Create Category API
- API endpoint: POST /api/categories
- Authentication: JWT required
- Authorization: Admin only
- Authorization header: Bearer JWT token
- Token validation: Verify using authenticateRequest()
- Request fields: name, slug, description
- Validation: Category name and slug are required
- Duplicate check: Prevent duplicate category name or slug
- Success response: success, message, data
- Success message: Category created successfully.
- Invalid/missing token: Return 401 Unauthorized
- Non-admin user: Return 403 Forbidden

Get All Categories API
- API endpoint: GET /api/categories
- Token validation: Verify using authenticateRequest()
- Retrieve all categories from the database
- Categories are ordered by creation date
- Success response: success, message, data
- Success message: Categories retrieved successfully.

Get Category by ID API
- API endpoint: GET /api/categories/:id
- Validate category ID
- Retrieve category by ID
- Category not found: Return 404 Not Found
- Success response: success, message, data
- Success message: Category retrieved successfully.
- Invalid/missing token: Return 401 Unauthorized

Update Category API
- API endpoint: PUT /api/categories/:id
- Authentication: JWT required
- Authorization: Admin only
- Authorization header: Bearer JWT token
- Token validation: Verify using authenticateRequest()
- Validate category ID
- Prevent duplicate category name or slug
- Category not found: Return 404 Not Found
- Success response: success, message, data
- Success message: Category updated successfully.
- Invalid/missing token: Return 401 Unauthorized
- Non-admin user: Return 403 Forbidden

Delete Category API
- API endpoint: DELETE /api/categories/:id
- Authentication: JWT required
- Authorization: Admin only
- Authorization header: Bearer JWT token
- Token validation: Verify using authenticateRequest()
- Validate category ID
- Check whether the category exists
- Prevent deletion if products are associated with the category
- Category not found: Return 404 Not Found
- Success response: success, message, data
- Success message: Category deleted successfully.
- Invalid/missing token: Return 401 Unauthorized
- Non-admin user: Return 403 Forbidden

Product CRUD
- Get all product: http://localhost:3001/api/products
- Post product: http://localhost:3001/api/products
body:
{
  "name": "Classic Black T-Shirt",
  "sku": "TSHIRT-BLK-001",
  "price": 1200,
  "discount": 1000,
  "status": "IN_STOCK",
  "shortDescription": "Classic black cotton t-shirt",
  "description": "<p>Premium quality cotton t-shirt.</p>",
  "videoUrl": null,
  "stock": 20,
  "isActive": true,
  "categoryId": 1
}
RESPONSE:
{
    "success": true,
    "message": "Product created successfully.",
    "data": {
        "id": 2,
        "title": "Classic Black T-Shirt",
        "sku": "TSHIRT-BLK-002",
        "price": 1200,
        "discount": 1000,
        "status": "in-stock",
        "short_description": "Classic black cotton t-shirt",
        "description": "<p>Premium quality cotton t-shirt.</p>",
        "video_url": null,
        "images": [],
        "colors": [],
        "sizes": [],
        "category": [
            {
                "id": 1,
                "name": "Consumer Electronics",
                "slug": "consumer-electronics"
            }
        ],
        "inventory": {
            "track_inventory": false,
            "combinations": []
        },
        "product_colors": [],
        "specifications": [],
        "faqs": []
    }
}
- PUT, GET BY ID, DELETE: http://localhost:3001/api/products/{id}

BANNER CRUD
- GET & POST BANNER: http://localhost:3001/api/banners
- body -> form data:
image: file
link: text
display_priority: text
is_active: text

Response:
{
    "data": {
        "id": 1,
        "image": "/api/banners/1/image",
        "link": "https://eyarafashion.com/",
        "display_priority": 2,
        "is_active": true,
        "created_at": "2026-10-07T18:04:06.659Z",
        "updated_at": "2026-10-07T18:09:31.241Z"
    }
}
- GET BY ID, PUT, DELETE: http://localhost:3001/api/banners/{id}

BANNER IMAGE API:
API ENDPOINT: http://localhost:3001/api/banners/1/image


# Cart API

## Get Cart API

- API endpoint: `GET /api/cart`
- Authentication: JWT optional
- Authorization: Guest and logged-in user both allowed
- Authorization header: `Bearer JWT token` (optional)
- Token validation: Verify using `authenticateRequest()`
- Cart resolution: Uses `resolveCart()` helper
- Logged-in user: Cart is fetched by `userId`
- Guest user: Cart is fetched by `cart_session_id` cookie
- New guest: If cookie not present, generate `sessionId` using `randomUUID()` and set HTTP-only cookie
- Cookie name: `cart_session_id`
- Cookie attributes: `httpOnly: true`, `sameSite: lax`, `path: /`, `maxAge: 30 days`
- Empty cart behavior: Return cart with empty items array, not 404
- Cart includes: items ordered by `createdAt` desc, product with images, variants and colors
- Price calculation: If variant has price use variant price, else if product has discount use discount, else product price
- Item fields returned: `id`, `product_id`, `title`, `sku`, `image`, `variant`, `color`, `unit_price`, `quantity`, `subtotal`
- Variant object returned: `id`, `name`, `value`, `stock`
- Cart summary fields: `total_items`, `subtotal`
- Success response: `success`, `message`, `data`
- Success message: `Cart loaded.`
- Invalid request body: Not applicable
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to load cart.`

## Add Item To Cart API

- API endpoint: `POST /api/cart`
- Authentication: JWT optional
- Authorization: Guest and logged-in user both allowed
- Authorization header: `Bearer JWT token` (optional)
- Token validation: Verify using `authenticateRequest()`
- Cart resolution: Uses `resolveCart()` helper
- Request fields: `productId` or `product_id`, `variantId` or `variant_id` (optional), `colorId` or `color_id` (optional), `quantity` (optional, default 1)
- Validation: `productId` must be a valid positive integer
- Validation: `quantity` must be a positive integer and at least 1
- Validation: Product must exist in the database
- Validation: Product must be active (`isActive: true`)
- Validation: If `variantId` provided, variant must belong to that product
- Validation: If `variantId` provided, variant stock must be greater than or equal to requested quantity
- Validation: If `variantId` not provided, product stock must be greater than or equal to requested quantity
- Validation: If `colorId` provided, color must belong to that product
- Duplicate handling: If same product with same variant and same color already exists in cart, increment quantity instead of creating a new row
- Cart creation: If cart does not exist, create new cart for user or guest
- Success response: `success`, `message`, `data`
- Success message: `Item added to cart.`
- Success status: `201 Created`
- Invalid/missing `productId`: Return `400 Bad Request`
- Invalid quantity: Return `400 Bad Request`
- Product not found: Return `404 Not Found`
- Product inactive: Return `400 Bad Request`
- Variant not found: Return `404 Not Found`
- Not enough variant stock: Return `400 Bad Request`
- Not enough product stock: Return `400 Bad Request`
- Color not found: Return `404 Not Found`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to add item to cart.`

## Update Cart Item API

- API endpoint: `PUT /api/cart/:id`
- Authentication: JWT optional
- Authorization: Guest and logged-in user both allowed
- Authorization header: `Bearer JWT token` (optional)
- Token validation: Verify using `authenticateRequest()`
- Cart resolution: Uses `resolveCart()` helper
- URL param: `id` is cart item ID
- Request fields: `quantity`
- Validation: Cart item ID must be a valid positive integer
- Validation: `quantity` must be a positive integer and at least 1
- Validation: Cart item must exist and belong to the resolved cart
- Stock validation: If item has `variantId`, use variant stock, else use product stock
- Stock validation: Only applied if product inventory `trackInventory` is true
- Stock validation: Return 400 if requested quantity exceeds available stock
- Ownership check: Cart item must belong to `cart.id` returned by `resolveCart()`
- Success response: `success`, `message`, `data`
- Success message: `Cart item quantity updated.`
- Invalid cart item ID: Return `400 Bad Request`
- Invalid quantity: Return `400 Bad Request`
- Cart item not found or not owned: Return `404 Not Found`
- Not enough stock: Return `400 Bad Request`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to update cart item.`

## Delete Cart Item API

- API endpoint: `DELETE /api/cart/:id`
- Authentication: JWT optional
- Authorization: Guest and logged-in user both allowed
- Authorization header: `Bearer JWT token` (optional)
- Token validation: Verify using `authenticateRequest()`
- Cart resolution: Uses `resolveCart()` helper
- URL param: `id` is cart item ID
- Validation: Cart item ID must be a valid positive integer
- Ownership check: Cart item must belong to `cart.id` returned by `resolveCart()`
- Delete behavior: Delete single cart item
- Empty cart handling: If no items remain in cart, delete the cart itself
- Success response: `success`, `message`, `data`
- Success message: `Item removed from cart.`
- Invalid cart item ID: Return `400 Bad Request`
- Cart item not found or not owned: Return `404 Not Found`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to remove item from cart.`

## Clear Cart API

- API endpoint: `DELETE /api/cart`
- Authentication: JWT optional
- Authorization: Guest and logged-in user both allowed
- Authorization header: `Bearer JWT token` (optional)
- Token validation: Verify using `authenticateRequest()`
- Cart resolution: Uses `resolveCart()` helper
- Delete behavior: Delete all cart items belonging to resolved cart
- Cart retention: Cart row is kept, only items removed
- Success response: `success`, `message`
- Success message: `Cart cleared.`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to clear cart.`

---

# Order API

## Create Order API

- API endpoint: `POST /api/orders`
- Authentication: JWT optional
- Authorization: Guest and logged-in user both allowed
- Authorization header: `Bearer JWT token` (optional)
- Token validation: Verify using `authenticateRequest()`
- Guest request fields: `guestName`, `guestPhone`, `guestAddress`
- Logged-in request fields: `shippingAddressId` (optional), `shippingAddress` (optional)
- Common request fields: `shippingFee` (optional, default 0), `items` (optional array)
- Item object fields: `productId` or `product_id`, `variantId` or `variant_id` (optional), `quantity`
- Validation: For guest, `guestName` is required
- Validation: For guest, `guestPhone` is required
- Validation: For guest, `guestAddress` is required
- Validation: For logged-in with `shippingAddressId`, address must belong to the user
- Validation: Final shipping address must not be empty
- Address resolution for guest: `shippingAddress = guestAddress`
- Address resolution for logged-in with `shippingAddressId`: Combine `fullName`, `phone`, `addressLine`, `city`, `postalCode`, `country` into a single string
- Address resolution for logged-in with plain `shippingAddress`: Use as-is
- Items source: If `items` array provided in body, use it
- Items source: If `items` not provided, fetch items from resolved cart
- Cart source for logged-in user: Cart by `userId`
- Cart source for guest user: Cart by `cart_session_id` cookie
- Empty cart handling: Return `400 Bad Request` with message `Cart is empty.`
- No items handling: Return `400 Bad Request` with message `No items to order.`
- Product validation: Product must exist and be active
- Variant validation: If `variantId` provided, variant must belong to that product
- Stock validation: If variant provided, variant stock must be enough
- Stock validation: If variant not provided, product stock must be enough
- Price calculation: If variant has price use variant price, else if product has discount use discount, else product price
- Server-side calculation: `unitPrice` is calculated on the server, client price is ignored
- Total calculation: `totalAmount = sum(unitPrice * quantity) + shippingFee`
- Transaction: Order creation, stock decrement and cart clear run inside `prisma.$transaction()`
- Stock decrement: `ProductVariant.stock` decremented if variant used
- Stock decrement: `Product.stock` decremented always
- Cart clear: All `CartItem` rows for resolved cart deleted
- Order status: `PENDING`
- Payment status: `PENDING`
- Payment method: Cash on Delivery
- Guest order fields: `guestName` and `guestPhone` set, `userId` null
- Logged-in order fields: `userId` set, `guestName` and `guestPhone` null
- Success response: `success`, `message`, `data`
- Success message: `Order placed successfully. Cash on delivery.`
- Success status: `201 Created`
- Missing guest name: Return `400 Bad Request`
- Missing guest phone: Return `400 Bad Request`
- Missing guest address: Return `400 Bad Request`
- Address not found for user: Return `404 Not Found`
- Missing shipping address: Return `400 Bad Request`
- Cart empty: Return `400 Bad Request`
- Product not available: Return `404 Not Found`
- Variant not found: Return `404 Not Found`
- Not enough stock: Return `400 Bad Request`
- Invalid item quantity: Return `400 Bad Request`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to place order.`

## Get All Orders API

- API endpoint: `GET /api/orders`
- Authentication: JWT required
- Authorization: Admin only
- Authorization header: `Bearer JWT token`
- Token validation: Verify using `authenticateRequest()`
- Query param: `status` (optional)
- Status filter values: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`
- Status normalization: Uppercase and replace `-` with `_` before filtering
- Ordering: Orders ordered by `createdAt` desc
- Includes: Order items with product id, name and sku
- Success response: `success`, `message`, `data`
- Success message: `Orders loaded.`
- Invalid/missing token: Return `401 Unauthorized`
- Non-admin user: Return `403 Forbidden`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to load orders.`

## Get Single Order API

- API endpoint: `GET /api/orders/:id`
- Authentication: Not required
- Authorization: Public
- URL param: `id` is order ID
- Validation: Order ID must be a valid positive integer
- Includes: Order items with product id, name and sku
- Guest order response: `user_id` null, `guest` object with `name` and `phone`
- Logged-in order response: `user_id` set, `guest` null
- Item fields returned: `id`, `product_id`, `title`, `sku`, `unit_price`, `quantity`, `subtotal`
- Success response: `success`, `message`, `data`
- Success message: `Order loaded.`
- Invalid order ID: Return `400 Bad Request`
- Order not found: Return `404 Not Found`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to load order.`

## Update Order API

- API endpoint: `PATCH /api/orders/:id`
- Authentication: JWT required
- Authorization: Admin only
- Authorization header: `Bearer JWT token`
- Token validation: Verify using `authenticateRequest()`
- URL param: `id` is order ID
- Request fields: `status` (optional), `paymentStatus` or `payment_status` (optional)
- Validation: Order ID must be a valid positive integer
- Validation: Order must exist
- Validation: `status` must be one of `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- Validation: `paymentStatus` must be one of `PENDING`, `PAID`, `FAILED`, `REFUNDED`
- Status normalization: Uppercase and replace `-` with `_`
- Validation: At least one valid field must be provided
- Success response: `success`, `message`, `data`
- Success message: `Order updated.`
- Invalid/missing token: Return `401 Unauthorized`
- Non-admin user: Return `403 Forbidden`
- Invalid order ID: Return `400 Bad Request`
- Order not found: Return `404 Not Found`
- Invalid order status: Return `400 Bad Request`
- Invalid payment status: Return `400 Bad Request`
- No valid fields to update: Return `400 Bad Request`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to update order.`

## Delete Order API

- API endpoint: `DELETE /api/orders/:id`
- Authentication: JWT required
- Authorization: Admin only
- Authorization header: `Bearer JWT token`
- Token validation: Verify using `authenticateRequest()`
- URL param: `id` is order ID
- Validation: Order ID must be a valid positive integer
- Validation: Order must exist
- Business rule: Delivered orders cannot be deleted
- Delete behavior: Order and its items are deleted via cascade
- Success response: `success`, `message`
- Success message: `Order deleted.`
- Invalid/missing token: Return `401 Unauthorized`
- Non-admin user: Return `403 Forbidden`
- Invalid order ID: Return `400 Bad Request`
- Order not found: Return `404 Not Found`
- Delivered order: Return `409 Conflict`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Failed to delete order.`

---

# Login API Update (Cart Merge)

## Login API

- API endpoint: `POST /api/auth/login`
- Authentication: Not required
- Request fields: `email`, `password`
- Validation: `email` and `password` are required
- Email normalization: Trim and lowercase
- Password verification: `bcrypt.compare()` against `passwordHash`
- Token generation: `SignJWT` with `userId`, `email`, `role`, algorithm `HS256`, expiration `7d`
- Cart merge: Call `mergeGuestCart()` if `cart_session_id` cookie exists
- Cart merge result: Guest cart items moved to user cart
- Cart merge result: Duplicate items merged by adding quantities
- Cart merge result: Guest cart deleted after merge
- Cookie cleanup: Delete `cart_session_id` cookie after merge
- Success response: `success`, `message`, `data`
- Success message: `Login successful.`
- Data fields: `token`, `user` with `id`, `name`, `email`, `role`
- Missing email or password: Return `400 Bad Request`
- Invalid credentials: Return `401 Unauthorized`
- Failure response: Return `500 Internal Server Error`
- Failure message: `Something went wrong while logging in.`

Account API
Get My Profile API
API endpoint: GET /api/account/me

Authentication: JWT required

Authorization: Any logged-in user

Authorization header: Bearer JWT token

Token validation: Verify using authenticateRequest()

Data source: Fetch from database using userId from token

Includes: User info with all addresses sorted by createdAt desc

Includes: _count.orders for total order count

Additional query: deliveredCount for delivered orders

Additional query: pendingCount for pending, confirmed, processing, shipped orders

Response user fields: id, name, email, phone, image, role, joined_at, updated_at

Response address fields: id, full_name, phone, address_line, city, postal_code, country, created_at

Response stats fields: total_orders, pending_orders, delivered_orders, wishlist

Role format: Lowercase (admin, customer)

Image field: Profile picture URL or null

Success response: success, message, data

Success message: User profile loaded.

Invalid/missing token: Return 401 Unauthorized

User not found: Return 404 Not Found

Failure response: Return 500 Internal Server Error

Failure message: Failed to load user profile.

Update Profile API
API endpoint: PUT /api/account/profile

Authentication: JWT required

Authorization: Any logged-in user

Authorization header: Bearer JWT token

Token validation: Verify using authenticateRequest()

Request fields: name (optional), phone (optional), image (optional)

Validation: name must be non-empty string if provided

Validation: phone must be string or null if provided

Validation: image must be string URL or null if provided

Empty phone handling: Empty string treated as null

Empty image handling: Empty string treated as null

Validation: At least one valid field must be provided

Updatable fields: Only name, phone, image

Non-updatable fields: email, role, passwordHash

Success response: success, message, data

Success message: Profile updated successfully.

Invalid/missing token: Return 401 Unauthorized

Invalid name: Return 400 Bad Request

Invalid phone: Return 400 Bad Request

Invalid image: Return 400 Bad Request

No valid fields: Return 400 Bad Request

Failure response: Return 500 Internal Server Error

Failure message: Failed to update profile.

Create Address API
API endpoint: POST /api/account/addresses

Authentication: JWT required

Authorization: Any logged-in user

Authorization header: Bearer JWT token

Token validation: Verify using authenticateRequest()

Request fields: fullName or full_name, phone, addressLine or address_line, city, postalCode or postal_code (optional), country (optional, default Bangladesh)

Validation: fullName required and non-empty

Validation: phone required and non-empty

Validation: addressLine required and non-empty

Validation: city required and non-empty

User association: Address saved with userId from token

Success response: success, message, data

Success message: Address added successfully.

Success status: 201 Created

Invalid/missing token: Return 401 Unauthorized

Missing required fields: Return 400 Bad Request

Failure response: Return 500 Internal Server Error

Failure message: Failed to add address.

Get My Addresses API
API endpoint: GET /api/account/addresses

Authentication: JWT required

Authorization: Any logged-in user

Authorization header: Bearer JWT token

Token validation: Verify using authenticateRequest()

Filter: Only addresses belonging to token userId

Ordering: Addresses ordered by createdAt desc

Success response: success, message, data

Success message: Addresses loaded.

Invalid/missing token: Return 401 Unauthorized

Failure response: Return 500 Internal Server Error

Failure message: Failed to load addresses.

Update Address API
API endpoint: PUT /api/account/addresses/:id

Authentication: JWT required

Authorization: Any logged-in user

Authorization header: Bearer JWT token

Token validation: Verify using authenticateRequest()

URL param: id is address ID

Ownership check: Address must belong to token userId

Request fields: fullName or full_name, phone, addressLine or address_line, city, postalCode or postal_code, country

Validation: Address ID must be valid positive integer

Validation: Address must exist and belong to the user

Validation: Provided fields must not be empty strings

Validation: At least one valid field must be provided

Success response: success, message, data

Success message: Address updated successfully.

Invalid/missing token: Return 401 Unauthorized

Invalid address ID: Return 400 Bad Request

Address not found: Return 404 Not Found

Empty field: Return 400 Bad Request

No valid fields: Return 400 Bad Request

Failure response: Return 500 Internal Server Error

Failure message: Failed to update address.

Delete Address API
API endpoint: DELETE /api/account/addresses/:id

Authentication: JWT required

Authorization: Any logged-in user

Authorization header: Bearer JWT token

Token validation: Verify using authenticateRequest()

URL param: id is address ID

Ownership check: Address must belong to token userId

Validation: Address ID must be valid positive integer

Validation: Address must exist and belong to the user

Delete behavior: Permanently deletes address row

Success response: success, message, data

Success message: Address deleted successfully.

Invalid/missing token: Return 401 Unauthorized

Invalid address ID: Return 400 Bad Request

Address not found: Return 404 Not Found

Failure response: Return 500 Internal Server Error

Failure message: Failed to delete address.

1. /api/products
GET http://localhost:3001/api/products
GET http://localhost:3001/api/products?category=t-shirts
GET http://localhost:3001/api/products?search=premium

2. /api/product-search
GET http://localhost:3001/api/product-search?q=premium
GET http://localhost:3001/api/product-search?q=black&category=t-shirts
GET http://localhost:3001/api/product-search?min_price=1000&max_price=3000

3. /api/product-pagination
GET http://localhost:3001/api/product-pagination?page=1&per_page=10
GET http://localhost:3001/api/product-pagination?page=2&per_page=10
GET http://localhost:3001/api/product-pagination?page=1&per_page=4&category=t-shirts
GET http://localhost:3001/api/product-pagination?search=premium&page=1&per_page=10

=================================================
Login API
API endpoint: POST /api/auth/login

Authentication: Not required

Request fields: email, password

Response data: token, user

Cart merge: Guest cart merged if cart_session_id cookie exists

Cookie cleanup: Deletes cart_session_id after merge

Success message: Login successful.

Invalid credentials: Return 401 Unauthorized

Forgot Password API
API endpoint: POST /api/auth/forgot-password

Authentication: Not required

Request field: email

Always returns success: Prevents email enumeration

Token generated: Random 64-char hex

Token expiry: 30 minutes

Token delivered: Email (SMTP) or console log (dev)

Reset link format: {FRONTEND_URL}/reset-password?token=xxx

Success message: If that email exists, a reset link has been sent.

Reset Password API
API endpoint: POST /api/auth/reset-password

Authentication: Not required

Request fields: token, password, confirmPassword

Validation: Token required, exists in DB, not expired

Validation: Password minimum 6 chars, matches confirm

Token single use: Deleted after successful reset

Success message: Password reset successfully. You can now log in.

Invalid token: Return 400 Bad Request

Account APIs
Get My Profile API
API endpoint: GET /api/account/me

Authentication: JWT required

Data source: Database using userId from token

Includes: User info, addresses, order stats

Response user fields: id, name, email, phone, image, role, joined_at, updated_at

Response stats fields: total_orders, pending_orders, delivered_orders, wishlist

Role format: Lowercase (admin, customer)

Success message: User profile loaded.

Update Profile API
API endpoint: PUT /api/account/profile

Authentication: JWT required

Content-Type: application/json

Request fields: name (optional), phone (optional)

Validation: Name non-empty string if provided

Validation: Phone string or null if provided

Validation: At least one field required

Non-updatable fields: email, role, passwordHash

Success message: Profile updated successfully.

Upload Avatar API
API endpoint: POST /api/account/upload-avatar

Authentication: JWT required

Content-Type: multipart/form-data

Form field: image (file, required)

Allowed types: JPEG, JPG, PNG, WebP

Max size: 2 MB

Save location: public/uploads/avatars/

Filename format: avatar-{userId}-{timestamp}.{ext}

Old avatar: Deleted automatically

DB update: User.image = new URL

Success status: 201 Created

Success message: Avatar uploaded successfully.

Change Password API
API endpoint: PUT /api/account/change-password

Authentication: JWT required

Content-Type: application/json

Request fields: currentPassword, newPassword, confirmPassword

Validation: Current password required and verified with bcrypt

Validation: New password min 6 chars

Validation: New and confirm must match

Validation: New must differ from current

Success message: Password changed successfully.

Wrong current password: Return 400 Bad Request

Get My Orders API
API endpoint: GET /api/account/orders

Authentication: JWT required

Filter: Only orders for token userId

Query param: status (optional)

Query param: page (optional, default 1)

Query param: per_page (optional, default 10, max 50)

Status values: pending, confirmed, processing, shipped, delivered, cancelled

Ordering: createdAt desc

Meta fields: current_page, per_page, total, total_pages, has_more

Success message: Orders loaded.

Inventory Summary API
API endpoint: GET /api/admin/inventory/summary

Authentication: JWT required

Authorization: Admin only

Response format: { message: "success", data: {...} }

Field tracked_products: Unique products with track inventory on

Field total_variants: Total variant count

Field units_on_hand: Sum of ProductVariant.stock

Field units_reserved: Sum of ProductVariant.held

Field low_stock: Variants with available > 0 and ≤ threshold

Field out_of_stock: Variants with available ≤ 0

Field stock_value: Sum of price × stock

Field low_stock_threshold: Default 3

Non-admin: Return 403 Forbidden

Failure message: failed

Inventory Variants List API
API endpoint: GET /api/admin/inventory/variants

Authentication: JWT required

Authorization: Admin only

Query params: search, filter, page, per_page

Filter values: all, in_stock, low_stock, out_of_stock, preorder, tracked

Search fields: value, product.name, product.sku

Ordering: productId asc, position asc

Default per_page: 30

Max per_page: 100

Response fields per variant: id, product_id, product_color_id, size_id, variant_key, sku, price, stock, reserved, held, available, low_stock_threshold, allow_preorder, is_active, position, label, low_stock, product, color, size

Product object: id, title, sku, status, track_inventory, first_image

Color object: id, name, code, image

Size object: id, size

Meta fields: current_page, per_page, total, total_pages, has_more

Non-admin: Return 403 Forbidden

Invalid filter: Return 400 Bad Request

Failure message: failed

Dashboard Summary API
API endpoint: GET /api/admin/dashboard/summary

Authentication: JWT required

Authorization: Admin only

Query param: range (optional, default month)

Range values: today, week, month, year, custom

Query param: from (only for custom range, format YYYY-MM-DD)

Query param: to (only for custom range, format YYYY-MM-DD)

Query param: hot_limit (optional, default 5, max 10)

Timezone: Asia/Dhaka

Response format: { message: "success", data: {...} }

range.from and range.to: Formatted as YYYY-MM-DD HH:mm:ss

totals.gross_sales: Sum of non-cancelled orders totalAmount

totals.orders: All orders count in range

totals.units_sold: Sum of item quantities in non-cancelled orders

totals.customers: Unique user IDs + unique guest phones

totals.average_order_value: gross_sales / non-cancelled orders count

totals.shipping_collected: Sum of shippingFee in non-cancelled orders

changes.*: Null (future scope — comparison vs previous period)

sales_trend[]: Daily sales and orders (non-cancelled only)

status_breakdown[]: Order count and sales per status with percentage

top_products[]: Best-selling products by sales amount

Cancelled orders: Excluded from sales, units, trend, top products

Cancelled orders: Included in totals.orders and status_breakdown

Non-admin: Return 403 Forbidden

Invalid range: Return 400 Bad Request

Failure response: { message: "failed", data: null }

Get All Sizes API (Public)
API endpoint: GET /api/sizes

Authentication: Not required

Filter: Only isActive: true

Response: Plain array [{ id, size }]

Ordering: position asc, id asc

Get All Sizes API (Admin)
API endpoint: GET /api/admin/sizes

Authentication: JWT required

Authorization: Admin only

Query params: search, status (all, active, inactive)

Response: { message: "success", data: [...] }

Data fields: id, size, position, is_active, created_at, updated_at

Create Size API
API endpoint: POST /api/admin/sizes

Authentication: JWT required

Authorization: Admin only

Request fields: size (required), position (optional, auto), isActive (optional, default true)

Validation: Size non-empty string, unique

Auto position: Max + 1 if not provided

Success status: 201 Created

Duplicate: Return 409 Conflict

Update Size API
API endpoint: PUT /api/admin/sizes/:id

Authentication: JWT required

Authorization: Admin only

Request fields: size, position, isActive (all optional)

Validation: Size unique if changed

Size not found: Return 404 Not Found

Duplicate: Return 409 Conflict

Delete Size API
API endpoint: DELETE /api/admin/sizes/:id

Authentication: JWT required

Authorization: Admin only

Prevent deletion: If used by any ProductVariant.value

Size not found: Return 404 Not Found

In use: Return 409 Conflict

Get All Orders API (Admin)
API endpoint: GET /api/admin/orders

Authentication: JWT required

Authorization: Admin only

Authorization header: Bearer JWT token

Query param search: Search user name, user phone, guest name, guest phone

Query param status: Filter by order status

Query param district: Filter by district (case-insensitive)

Query param product_id: Filter orders containing this product

Query param min_price: Filter by min total amount

Query param max_price: Filter by max total amount

Query param from: Filter from date (YYYY-MM-DD)

Query param to: Filter to date (YYYY-MM-DD)

Query param page: Pagination page (default 1)

Query param per_page: Items per page (default 50, max 100)

Status values: pending, confirmed, processing, shipped, delivered, cancelled

Search mode: Case-insensitive using mode: "insensitive"

Ordering: createdAt desc

Includes: Order items, product info (id, name, sku, first image), user info (id, name, phone, email)

Response fields: id, order_number, user_id, name, phone, address, district, shipping_cost, subtotal, total, advance_payment, payment_method, delivery_notes, status, courier_entry, created_at, updated_at, customer_type, assigned_badge, order_items

Item fields: id, order_id, product_id, product_variant_id, title, sku, unitPrice, qty, totalPrice, colorImage, color_name, size, variant

Meta fields: current_page, per_page, total, total_pages, has_more, from, to

Success response: success, message, data, meta

Success message: Orders loaded.

Invalid/missing token: Return 401 Unauthorized

Non-admin user: Return 403 Forbidden

Failure message: Failed to load orders.

Get Order Product Options API (Admin)
API endpoint: GET /api/admin/orders/product-options

Authentication: JWT required

Authorization: Admin only

Response fields per item: id, title, sku

Title mapping: title from Product.name

Ordering: name asc

Use case: Product filter dropdown populate

Success response: success, message, data

Success message: Product options loaded.

Invalid/missing token: Return 401 Unauthorized

Non-admin user: Return 403 Forbidden

Failure message: Failed to load products.

Get Order Districts API (Admin)
API endpoint: GET /api/admin/orders/districts

Authentication: JWT required

Authorization: Admin only

Filter: Excludes null districts

Distinct: Unique districts only

Ordering: district asc

Response: Plain array of district strings

Use case: District filter dropdown populate

Success response: success, message, data

Success message: Districts loaded.

Invalid/missing token: Return 401 Unauthorized

Non-admin user: Return 403 Forbidden

Failure message: Failed to load districts.

Get Single Order API (Admin)
API endpoint: GET /api/admin/orders/:id

Authentication: JWT required

Authorization: Admin only

URL param: id is order ID

Validation: Order ID must be valid positive integer

Includes: Order items with product id, name, sku

Response fields: id, user_id, guest, status, payment_status, total_amount, shipping_fee, shipping_address, district, advance_payment, payment_method, items, created_at, updated_at

Guest order: user_id null, guest object with name and phone

Success response: success, message, data

Success message: Order loaded.

Invalid order ID: Return 400 Bad Request

Order not found: Return 404 Not Found

Invalid/missing token: Return 401 Unauthorized

Non-admin user: Return 403 Forbidden

Failure message: Failed to load order.

Update Order API (Admin)
API endpoint: PATCH /api/admin/orders/:id

Authentication: JWT required

Authorization: Admin only

URL param: id is order ID

Request fields: status (optional), paymentStatus or payment_status (optional)

Valid statuses: pending, confirmed, processing, shipped, delivered, cancelled

Valid payment statuses: pending, paid, failed, refunded

Status normalization: Uppercase and replace - with _

Validation: At least one field required

Validation: Order must exist

Success response: success, message, data

Success message: Order updated.

Invalid order ID: Return 400 Bad Request

Invalid status: Return 400 Bad Request

Invalid payment status: Return 400 Bad Request

No valid fields: Return 400 Bad Request

Order not found: Return 404 Not Found

Invalid/missing token: Return 401 Unauthorized

Non-admin user: Return 403 Forbidden

Failure message: Failed to update order.

Delete Order API (Admin)
API endpoint: DELETE /api/admin/orders/:id

Authentication: JWT required

Authorization: Admin only

URL param: id is order ID

Business rule: Delivered orders cannot be deleted

Validation: Order must exist

Delete behavior: Order and its items deleted via cascade

Success response: success, message

Success message: Order deleted.

Invalid order ID: Return 400 Bad Request

Delivered order: Return 409 Conflict

Order not found: Return 404 Not Found

Invalid/missing token: Return 401 Unauthorized

Non-admin user: Return 403 Forbidden

Failure message: Failed to delete order.

Create Order API (Public)
API endpoint: POST /api/orders

Authentication: Optional (guest + logged-in)

Guest request fields: guestName, guestPhone, guestAddress

Logged-in request fields: shippingAddressId (optional), shippingAddress (optional)

Common request fields: district (optional), shippingFee (optional, default 0), advancePayment (optional, default 0), paymentMethod (optional, default cash), items (optional array)

Item fields: productId or product_id, variantId or variant_id (optional), quantity

Items source: If not provided, fetched from resolved cart

Cart source: userId if logged in, cart_session_id cookie if guest

Price calculation: Server-side (variant price > discount > product price)

Total: sum(unitPrice * quantity) + shippingFee

Transaction: Order create, stock decrement, cart clear

Stock decrement: Product.stock and ProductVariant.stock

Order status: PENDING

Payment status: PENDING

Guest order fields: guestName and guestPhone set, userId null

Logged-in order fields: userId set, guestName and guestPhone null

Success status: 201 Created

Success message: Order placed successfully. Cash on delivery.

Missing guest name: Return 400 Bad Request

Missing guest phone: Return 400 Bad Request

Missing guest address: Return 400 Bad Request

Address not found for user: Return 404 Not Found

Cart empty: Return 400 Bad Request

Product not available: Return 404 Not Found

Variant not found: Return 404 Not Found

Not enough stock: Return 400 Bad Request

Invalid item quantity: Return 400 Bad Request

Failure message: Failed to place order.

Get Single Order API (Public)
API endpoint: GET /api/orders/:id

Authentication: Not required

Authorization: Public

URL param: id is order ID

Validation: Order ID must be valid positive integer

Includes: Order items with product id, name, sku

Response fields: id, user_id, guest, status, payment_status, total_amount, shipping_fee, shipping_address, district, advance_payment, payment_method, items, created_at, updated_at

Guest order: user_id null, guest object with name and phone

Item fields: id, product_id, title, sku, unit_price, quantity, subtotal

Success response: success, message, data

Success message: Order loaded.

Invalid order ID: Return 400 Bad Request

Order not found: Return 404 Not Found

Failure message: Failed to load order.

Sales Report API
API endpoint: GET /api/admin/sales-report

Authentication: JWT required

Authorization: Admin only

Query param start_date: Start date (YYYY-MM-DD), default 30 days ago

Query param end_date: End date (YYYY-MM-DD), default today

Query param status: Filter by order status (all, pending, confirmed, processing, shipped, delivered, cancelled)

Query param product: Search in product title or SKU

Query param sort: Sort products by (revenue, quantity, orders), default revenue

Timezone: Asia/Dhaka

Cancelled orders: Excluded from sales totals, daily sales, product aggregation

Cancelled orders: Included in status breakdown

Response format: success, message, data

Response data.range: from, to, timezone

Response data.summary: gross_sales, orders, units_sold, customers, average_order_value, shipping_collected, products_ordered

Response data.products[]: product_id, title, sku, product_status, image, order_count, customer_count, quantity_sold, gross_sales, average_unit_price, last_ordered_at

Response data.daily_sales[]: date, orders, sales, customers

Response data.status_breakdown[]: status, orders, sales

Default range: Last 30 days

Invalid date: Ignored, default applies

Non-admin: Return 403 Forbidden

Failure message: Failed to load sales report.

Get All Abandoned Checkouts API (Admin)
API endpoint: GET /api/admin/abandoned-checkouts

Authentication: JWT required

Authorization: Admin only

Query params: search, status, recovered, page, per_page

Search fields: name, phone, sessionId

Status values: pending, cancelled, completed, converted

Recovered values: true, false

Default per_page: 50

Max per_page: 100

Ordering: createdAt desc

Response fields: id, session_id, user_id, cart_items, name, phone, address, is_recovered, status, converted_order_id, converted_at, created_at, updated_at

Meta fields: current_page, per_page, total, total_pages, has_more, from, to

Success message: Abandoned checkouts loaded.

Non-admin: Return 403 Forbidden

Save Abandoned Checkout API (Public)
API endpoint: POST /api/abandoned-checkouts

Authentication: Not required

Request fields: sessionId, cartItems, userId (optional), name (optional), phone (optional), address (optional)

Validation: sessionId and non-empty cartItems required

Upsert: Same sessionId hole update, new hole create

Success status: 201 Created (new) / 200 OK (update)

Success message: Abandoned checkout saved.

Get Latest Shipping Cost API (Admin)
API endpoint: GET /api/admin/shipping-costs-latest

Authentication: JWT required

Authorization: Admin only

Response format: Direct object (no wrapper — reference API match)

Fields: id, inside_dhaka, outside_dhaka, one_shipping_cost, created_at, updated_at

Auto-create: Jodi kono row na thake, default (80/150) diye create hoy

Non-admin: Return 403 Forbidden

Create Shipping Cost API (Admin)
API endpoint: POST /api/admin/shipping-costs

Authentication: JWT required

Authorization: Admin only

Request fields: inside_dhaka or insideDhaka, outside_dhaka or outsideDhaka, one_shipping_cost or oneShippingCost (optional)

Validation: Inside + outside dhaka required and numeric

Behavior: Versioning — notun row create hoy

Success status: 201 Created

Success message: Shipping cost updated.

=========================================================

Get Customer Leaderboard API
API endpoint: GET /api/admin/customer-leaderboard

Authentication: JWT required

Authorization: Admin only

Query params: search, sort, page, per_page

Customer sources: User (logged) + guest orders grouped by guestPhone

Badge source: User.badge for logged users, Order.assignedBadge for guests

Badge value: Plain string (e.g., "vip") or null

Backend badge validation: Nai — badge value blindly save hoy

Frontend responsibility: Valid badge list, labels, colors, dropdown options

Response badge field: null jodi customer er badge set na thake

Meta fields: current_page, per_page, total, total_pages, has_more, from, to

Success message: Customer leaderboard loaded.

Update Customer Badge API
API endpoint: PATCH /api/admin/customer-leaderboard/:key/badge

Authentication: JWT required

Authorization: Admin only

URL param key: format user:2 or guest:01712345678 (URL encoded)

Request field: badge — string (any value accepted) or null

Validation: badge must be string or null (non-string value → 400)

Validation: Empty/whitespace string → 400

Behavior for user: Update User.badge

Behavior for guest: Update all Order.assignedBadge where guestPhone = id and userId = null

Success message: Badge updated.

Get Customer Statistics API
API endpoint: GET /api/admin/customers/statistics

Authentication: JWT required

Authorization: Admin only

Customer sources: User (logged) + guest orders grouped by guestPhone

Response fields: total_customers, total_orders, total_revenue, average_order_value, new_customers, repeat_customers

total_revenue: Rounded to nearest integer

average_order_value: Rounded to 4 decimal places

new_customers: Customers with exactly 1 order

repeat_customers: Customers with 2 or more orders

Cancelled orders: Excluded from total_revenue and average_order_value

Success message: None (reference match)

Get Customer Profiles API
API endpoint: GET /api/admin/customer-profiles

Authentication: JWT required

Authorization: Admin only

Query params: search, has_account, page, per_page

Search fields: name, phone, email

has_account values: true, false

Default per_page: 20

Max per_page: 100

Response format: Laravel-style pagination match

Pagination fields: current_page, data, first_page_url, from, last_page, last_page_url, next_page_url, path, per_page, prev_page_url, to, total

Data fields: id, name, phone, email, user_id, has_user_account, assigned_badge, created_at, updated_at

id: Synthetic (index + 1), not a real DB ID

Customer sources: User (logged) + guest orders grouped by guestPhone

Ordering: createdAt desc

Success message: None (reference match)

Get All Shipping Costs API
API endpoint: GET /api/admin/shipping-costs

Authentication: JWT required

Authorization: Admin only

Ordering: createdAt desc (newest first)

Response format: { data: [...] }

Data fields: id, inside_dhaka, outside_dhaka, one_shipping_cost, created_at, updated_at

inside_dhaka and outside_dhaka: Numbers

one_shipping_cost: Number or null

Success message: None (reference match)

Non-admin: Return 403 Forbidden

Create Shipping Cost API
API endpoint: POST /api/admin/shipping-costs

Authentication: JWT required

Authorization: Admin only

Request fields: inside_dhaka or insideDhaka, outside_dhaka or outsideDhaka, one_shipping_cost or oneShippingCost (optional)

Validation: Inside + outside required, must be numeric

Behavior: Creates new row (versioning)

Success status: 201 Created

Success message: Shipping cost updated.

Delete Shipping Cost API
API endpoint: DELETE /api/admin/shipping-costs/:id

Authentication: JWT required

Authorization: Admin only

URL param: id

Validation: Valid positive integer

Validation: Shipping cost must exist

Business rule: Cannot delete the only remaining entry

Success message: Shipping cost deleted.

Invalid ID: Return 400 Bad Request

Not found: Return 404 Not Found

Last entry: Return 409 Conflict

Non-admin: Return