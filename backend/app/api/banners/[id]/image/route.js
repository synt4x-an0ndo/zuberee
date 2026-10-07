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

        if (!banner) {
            return new Response("Banner not found.", {
                status: 404,
            });
        }

        return new Response(banner.image, {
            status: 200,
            headers: {
                "Content-Type": banner.imageType,
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