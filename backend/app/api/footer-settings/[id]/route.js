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

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const footerId = Number(id);

        if (!Number.isInteger(footerId) || footerId <= 0) {
            return Response.json(
                { message: "Invalid footer ID." },
                { status: 400 }
            );
        }

        const footer = await prisma.footerSettings.findUnique({
            where: { id: footerId },
        });

        if (!footer) {
            return Response.json(
                { message: "Footer not found." },
                { status: 404 }
            );
        }

        return Response.json(formatFooter(footer));
    } catch (error) {
        console.error("GET /api/footer-settings/:id error:", error);

        return Response.json(
            { message: "Failed to fetch footer." },
            { status: 500 }
        );
    }
}