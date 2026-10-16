import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "@/directory/auth/auth.js";

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
 * The file is stored exactly like product images are
 * (backend/public/storage/<folder>/<uuid>.<ext>) and the stored path is
 * returned, ready to paste straight into the field it was uploaded for:
 *   201 { success: true, message: "Image uploaded successfully.",
 *         data: { image: "/storage/about/<uuid>.jpg", url: "/storage/about/<uuid>.jpg" } }
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

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
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

        const storageDirectory = path.join(process.cwd(), "public", "storage", folder);
        await mkdir(storageDirectory, { recursive: true });

        const fileName = `${randomUUID()}${extension}`;
        await writeFile(path.join(storageDirectory, fileName), Buffer.from(await image.arrayBuffer()));

        const imagePath = `/storage/${folder}/${fileName}`;

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
