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

