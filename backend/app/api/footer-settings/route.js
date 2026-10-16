import prisma from "@/directory/prisma/prisma.js";

function formatFooter(f) {
    return {
        id: f.id,
        logo_path: f.logoPath,
        company_description: f.companyDescription,
        company_address: f.companyAddress,
        company_email: f.companyEmail,
        company_phone: f.companyPhone,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
    };
}

export async function GET() {
    try {
        const footer = await prisma.footerSettings.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!footer) {
            return Response.json(
                { message: "Footer not configured." },
                { status: 404 }
            );
        }

        return Response.json(formatFooter(footer));
    } catch (error) {
        console.error("GET /api/footer-settings error:", error);

        return Response.json(
            { message: "Failed to fetch footer settings." },
            { status: 500 }
        );
    }
}