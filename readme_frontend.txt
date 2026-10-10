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
