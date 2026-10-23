import { authenticateRequest } from "@/directory/auth/auth.js";
import { isStaffRole } from "@/lib/access.js";
import { saveMediaFile } from "@/lib/media-store.js";

/**
 * POST /api/admin/upload-image  (ADMIN only, multipart/form-data)
 *
 * Generic admin image upload for fields that store an image path/URL
 * (About us image, company logo, product colour images, ...). Before this
 * route existed the admin could only paste a path for those fields; product
 * photos and banners already had their own dedicated upload routes and are
 * unchanged.
 *
 * Form fields:
 *   image   file, required — JPEG, PNG, WEBP or GIF, max 5 MB
 *   folder  optional allow-listed sub-folder under public/storage
 *           (general | about | logos | colors | products | banners | settings)
 *
 * The bytes are stored in Postgres (media_assets, base64 text) and served by
 * GET /api/media/:id, so an upload is usable immediately even in production:
 *   201 { success: true, message: "Image uploaded successfully.",
 *         data: { image: "/api/media/<uuid>", url: "/api/media/<uuid>" } }
 */

const ALLOWED_IMAGE_TYPES = new Map([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
]);

const ALLOWED_FOLDERS = new Set([
    "general",
    "about",
    "logos",
    "favicons",
    "colors",
    "products",
    "banners",
    "settings",
]);

const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const formData = await request.formData();
        const image = formData.get("image");
        const extension = image && ALLOWED_IMAGE_TYPES.get(image.type);

        if (!image || typeof image === "string" || !extension) {
            return Response.json(
                {
                    success: false,
                    message: "A JPEG, PNG, WEBP, or GIF image file is required.",
                },
                { status: 400 }
            );
        }

        if (image.size > MAX_SIZE) {
            return Response.json(
                { success: false, message: "Image size must not exceed 5MB." },
                { status: 400 }
            );
        }

        const requestedFolder = String(formData.get("folder") || "general")
            .trim()
            .toLowerCase();
        const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "general";

        // Postgres, not public/: an upload made while the server is running has
        // to be servable without a rebuild or a restart (lib/media-store.js).
        const stored = await saveMediaFile(image, folder);
        const imagePath = stored.url;

        return Response.json(
            {
                success: true,
                message: "Image uploaded successfully.",
                data: { image: imagePath, url: imagePath },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Admin upload image API error:", error);
        return Response.json(
            { success: false, message: "Failed to upload image." },
            { status: 500 }
        );
    }
}
