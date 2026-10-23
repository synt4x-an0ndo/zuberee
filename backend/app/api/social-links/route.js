import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

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
        messenger: s.messenger,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
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
            facebook,
            youtube,
            instagram,
            twitter,
            pinterest,
            facebook_id,
            facebookId,
            whatsapp_number,
            whatsappNumber,
            messenger,
        } = body;

        const updateData = {};

        const handleUrl = (val, field) => {
            if (val === undefined) return;
            updateData[field] =
                val === null || val === ""
                    ? null
                    : String(val).trim();
        };

        handleUrl(facebook, "facebook");
        handleUrl(youtube, "youtube");
        handleUrl(instagram, "instagram");
        handleUrl(twitter, "twitter");
        handleUrl(pinterest, "pinterest");

        const finalFbId = facebook_id ?? facebookId;
        if (finalFbId !== undefined) {
            updateData.facebookId =
                finalFbId === null || finalFbId === ""
                    ? null
                    : String(finalFbId).trim();
        }

        const finalWhatsapp = whatsapp_number ?? whatsappNumber;
        if (finalWhatsapp !== undefined) {
            updateData.whatsappNumber =
                finalWhatsapp === null || finalWhatsapp === ""
                    ? null
                    : String(finalWhatsapp).trim();
        }

        handleUrl(messenger, "messenger");

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        let existing = await prisma.socialLinks.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!existing) {
            existing = await prisma.socialLinks.create({
                data: updateData,
            });

            return Response.json(
                {
                    success: true,
                    message: "Social links created.",
                    data: formatSocialLinks(existing),
                },
                { status: 201 }
            );
        }

        const updated = await prisma.socialLinks.update({
            where: { id: existing.id },
            data: updateData,
        });

        return Response.json({
            success: true,
            message: "Social links updated.",
            data: formatSocialLinks(updated),
        });
    } catch (error) {
        console.error("PUT /api/admin/social-links error:", error);

        return Response.json(
            { success: false, message: "Failed to update social links." },
            { status: 500 }
        );
    }
}