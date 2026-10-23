import prisma from "../directory/prisma/prisma.js";

/**
 * Uploaded images are kept in Postgres as base64 text and served by
 * GET /api/media/:id.
 *
 * Why: Next.js only serves files that were already inside `public/` when the
 * production build ran. An image written to `backend/public/storage/...` at
 * runtime therefore 404s until the server is rebuilt and restarted. Reading the
 * bytes from the database lets a running server serve an upload immediately.
 *
 * Nothing is migrated: rows saved earlier keep their `/storage/...` path and
 * continue to be served from `public/` by Next.
 */

export const MEDIA_URL_PREFIX = "/api/media/";

/** The one place that decides which image types an upload may use. */
export const ALLOWED_IMAGE_TYPES = new Map([
    ["image/jpeg", ".jpg"],
    ["image/jpg", ".jpg"], // some clients send this alias
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
]);

export function mediaUrl(id) {
    return `${MEDIA_URL_PREFIX}${id}`;
}

export function isMediaUrl(value) {
    return typeof value === "string" && value.startsWith(MEDIA_URL_PREFIX);
}

export function mediaIdFromUrl(value) {
    if (!isMediaUrl(value)) return null;
    const id = value.slice(MEDIA_URL_PREFIX.length).split(/[?#]/)[0];
    return id || null;
}

/**
 * Stores one uploaded File in Postgres.
 * @returns {Promise<{id: string, url: string, mimeType: string, byteSize: number}>}
 */
export async function saveMediaFile(file, folder = "general") {
    const mimeType = String(file?.type || "").toLowerCase();
    const extension = ALLOWED_IMAGE_TYPES.get(mimeType);

    if (!extension) {
        const error = new Error("A JPEG, PNG, WEBP or GIF image is required.");
        error.status = 400;
        throw error;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!buffer.length) {
        const error = new Error("The uploaded file is empty.");
        error.status = 400;
        throw error;
    }

    const asset = await prisma.mediaAsset.create({
        data: {
            folder: String(folder || "general").trim().toLowerCase() || "general",
            mimeType,
            extension,
            byteSize: buffer.length,
            data: buffer.toString("base64"),
        },
        select: { id: true, mimeType: true, byteSize: true },
    });

    return {
        id: asset.id,
        url: mediaUrl(asset.id),
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
    };
}

/** Reads one asset back as bytes, or returns null when it does not exist. */
export async function readMediaFile(id) {
    if (!id || typeof id !== "string") return null;

    const asset = await prisma.mediaAsset.findUnique({
        where: { id },
        select: { data: true, mimeType: true },
    });

    if (!asset) return null;

    return { buffer: Buffer.from(asset.data, "base64"), mimeType: asset.mimeType };
}

/**
 * Best-effort delete, used when an image is replaced or its owner is removed.
 * Legacy `/storage/...` and `/uploads/...` paths are ignored here: those files
 * live on disk and are cleaned up by the caller.
 */
export async function deleteMediaFileByUrl(url) {
    const id = mediaIdFromUrl(url);
    if (!id) return false;

    try {
        await prisma.mediaAsset.delete({ where: { id } });
        return true;
    } catch {
        return false;
    }
}
