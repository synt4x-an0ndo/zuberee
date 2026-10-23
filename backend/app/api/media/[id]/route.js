import { readMediaFile } from "../../../../lib/media-store.js";

// Always read from Postgres at request time - never prerender this route at
// build time, so a brand-new upload is served without a rebuild.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/media/:id
 *
 * Serves an image that was uploaded to the running server. The bytes live in
 * Postgres (see lib/media-store.js), so this works in production without a
 * rebuild or restart. Ids are UUIDs and never reused, which makes the response
 * safe to cache forever on the client and on a CDN.
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const asset = await readMediaFile(id);

        if (!asset) {
            return new Response("Image not found.", { status: 404 });
        }

        return new Response(new Uint8Array(asset.buffer), {
            status: 200,
            headers: {
                "Content-Type": asset.mimeType,
                "Content-Length": String(asset.buffer.length),
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("GET /api/media/:id error:", error);
        return new Response("Failed to load image.", { status: 500 });
    }
}
