import prisma from "@/directory/prisma/prisma.js";

function formatAboutUs(a) {
    return {
        id: a.id,
        title: a.title,
        content: a.content,
        image: a.image,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
    };
}

export async function GET() {
    try {
        let about = await prisma.aboutUs.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!about) {
            return Response.json(
                { message: "About us not configured yet." },
                { status: 404 }
            );
        }

        return Response.json(formatAboutUs(about));
    } catch (error) {
        console.error("GET /api/about-us error:", error);

        return Response.json(
            { message: "Failed to fetch about us." },
            { status: 500 }
        );
    }
}