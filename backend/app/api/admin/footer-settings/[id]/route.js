import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

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

export async function PUT(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const footerId = Number(id);

        if (!Number.isInteger(footerId) || footerId <= 0) {
            return Response.json(
                { success: false, message: "Invalid footer ID." },
                { status: 400 }
            );
        }

        let body = {};

        try {
            body = await request.json();
        } catch {
            return Response.json(
                { success: false, message: "Request body is required." },
                { status: 400 }
            );
        }

        const {
            logo_path,
            logoPath,
            company_description,
            companyDescription,
            company_address,
            companyAddress,
            company_email,
            companyEmail,
            company_phone,
            companyPhone,
        } = body;

        const updateData = {};

        const finalLogo = logo_path ?? logoPath;
        if (finalLogo !== undefined) {
            updateData.logoPath =
                finalLogo === null || finalLogo === ""
                    ? null
                    : String(finalLogo).trim();
        }

        const finalDesc =
            company_description ?? companyDescription;
        if (finalDesc !== undefined) {
            updateData.companyDescription =
                finalDesc === null || finalDesc === ""
                    ? null
                    : String(finalDesc);
        }

        const finalAddr = company_address ?? companyAddress;
        if (finalAddr !== undefined) {
            updateData.companyAddress =
                finalAddr === null || finalAddr === ""
                    ? null
                    : String(finalAddr).trim();
        }

        const finalEmail = company_email ?? companyEmail;
        if (finalEmail !== undefined) {
            updateData.companyEmail =
                finalEmail === null || finalEmail === ""
                    ? null
                    : String(finalEmail).trim();
        }

        const finalPhone = company_phone ?? companyPhone;
        if (finalPhone !== undefined) {
            updateData.companyPhone =
                finalPhone === null || finalPhone === ""
                    ? null
                    : String(finalPhone).trim();
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        const existing = await prisma.footerSettings.findUnique({
            where: { id: footerId },
        });

        if (!existing) {
            return Response.json(
                { success: false, message: "Footer not found." },
                { status: 404 }
            );
        }

        const updated = await prisma.footerSettings.update({
            where: { id: footerId },
            data: updateData,
        });

        return Response.json({
            success: true,
            message: "Footer updated.",
            data: formatFooter(updated),
        });
    } catch (error) {
        console.error("PUT /api/admin/footer-settings/:id error:", error);

        return Response.json(
            { success: false, message: "Failed to update footer." },
            { status: 500 }
        );
    }
}