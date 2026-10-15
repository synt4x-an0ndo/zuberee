import prisma from "../../directory/prisma/prisma.js";

function formatSocialLinks(s) {
    return {
        id: s.id,
        facebook: s.facebook,
        youtube: s.youtube,
        instagram: s.instagram,
        twitter: s.twitter,
        pinterest: s.pinterest,
        facebook_id: s.facebookId,
        whatsapp_number: s.whatsappNumber,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
    };
}

export async function GET() {
    try {
        const social = await prisma.socialLinks.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!social) {
            return Response.json(
                { message: "Social links not configured." },
                { status: 404 }
            );
        }

        return Response.json(formatSocialLinks(social));
    } catch (error) {
        console.error("GET /api/social-links-first error:", error);

        return Response.json(
            { message: "Failed to fetch social links." },
            { status: 500 }
        );
    }
}