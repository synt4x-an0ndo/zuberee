import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

/**
 * PUT /api/admin/footer-settings  (ADMIN)
 *
 * Create-or-update ("upsert") for the single footer-settings row.
 *
 * Why this exists: until now the backend only exposed
 * PUT /api/admin/footer-settings/:id, which updates a row that must already
 * exist — and there was no create endpoint, so on a fresh database (no
 * footer row yet) the admin could not save the store logo / company details
 * at all (GET /api/footer-settings returned 404 "Footer not configured.").
 * This route updates the earliest footer row when one exists and creates it
 * otherwise, mirroring the PUT /api/social-links upsert pattern.
 *
 * The older PUT /api/admin/footer-settings/:id route is unchanged and keeps
 * working; both accept the same JSON fields:
 *   { logo_path?, company_description?, company_address?, company_email?, company_phone? }
 * (camelCase aliases logoPath, companyDescription, ... are also accepted.)
 * Empty string / null clears a field. Response: { success, message, data }
 * with the same formatted shape as GET /api/footer-settings.
 */
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

export async function PUT(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
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

        const existing = await prisma.footerSettings.findFirst({
            orderBy: { createdAt: "asc" },
        });

        const saved = existing
            ? await prisma.footerSettings.update({
                  where: { id: existing.id },
                  data: updateData,
              })
            : await prisma.footerSettings.create({
                  data: updateData,
              });

        return Response.json({
            success: true,
            message: existing ? "Footer updated." : "Footer created.",
            data: formatFooter(saved),
        });
    } catch (error) {
        console.error("PUT /api/admin/footer-settings error:", error);

        return Response.json(
            { success: false, message: "Failed to save footer settings." },
            { status: 500 }
        );
    }
}
