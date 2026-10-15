import prisma from "../../../../../directory/prisma/prisma.js";

export async function GET(request, { params }) {
    try {
        const { id: bannerId } = await params;
        const id = Number(bannerId);

        if (!Number.isInteger(id) || id <= 0) {
            return new Response("Invalid banner ID.", {
                status: 400,
            });
        }

        const banner = await prisma.banner.findUnique({
            where: { id },
            select: {
                image: true,
                imageType: true,
            },
        });

        if (!banner || !banner.image) {
            return new Response("Banner not found.", {
                status: 404,
            });
        }

        let imageBuffer;

        if (Buffer.isBuffer(banner.image)) {
            imageBuffer = new Uint8Array(banner.image);
        } else if (banner.image instanceof Uint8Array) {
            imageBuffer = banner.image;
        } else if (banner.image?.type === "Buffer" && Array.isArray(banner.image.data)) {
            imageBuffer = new Uint8Array(banner.image.data);
        } else {
            imageBuffer = new Uint8Array(banner.image);
        }

        return new Response(imageBuffer, {
            status: 200,
            headers: {
                "Content-Type": banner.imageType || "image/jpeg",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("GET /api/banners/:id/image error:", error);

        return new Response("Failed to load banner image.", {
            status: 500,
        });
    }
}