import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatFacebookSettings(f) {
    return {
        id: f.id,
        pixel_id: f.pixelId,
        access_token: f.accessToken,
        test_event_code: f.testEventCode,
        is_active: f.isActive,
        is_test_mode: f.isTestMode,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
    };
}

export async function PUT(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
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
            pixel_id,
            pixelId,
            access_token,
            accessToken,
            test_event_code,
            testEventCode,
            is_active,
            isActive,
            is_test_mode,
            isTestMode,
        } = body;

        const updateData = {};

        const finalPixel = pixel_id ?? pixelId;
        if (finalPixel !== undefined) {
            updateData.pixelId =
                finalPixel === null || finalPixel === ""
                    ? null
                    : String(finalPixel).trim();
        }

        const finalToken = access_token ?? accessToken;
        if (finalToken !== undefined) {
            updateData.accessToken =
                finalToken === null || finalToken === ""
                    ? null
                    : String(finalToken).trim();
        }

        const finalTestCode =
            test_event_code ?? testEventCode;
        if (finalTestCode !== undefined) {
            updateData.testEventCode =
                finalTestCode === null || finalTestCode === ""
                    ? null
                    : String(finalTestCode).trim();
        }

        const finalActive = is_active ?? isActive;
        if (finalActive !== undefined) {
            updateData.isActive = Boolean(finalActive);
        }

        const finalTestMode = is_test_mode ?? isTestMode;
        if (finalTestMode !== undefined) {
            updateData.isTestMode = Boolean(finalTestMode);
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        let existing = await prisma.facebookSettings.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!existing) {
            existing = await prisma.facebookSettings.create({
                data: updateData,
            });

            return Response.json(
                {
                    success: true,
                    message: "Facebook settings created.",
                    data: formatFacebookSettings(existing),
                },
                { status: 201 }
            );
        }

        const updated = await prisma.facebookSettings.update({
            where: { id: existing.id },
            data: updateData,
        });

        return Response.json({
            success: true,
            message: "Facebook settings updated.",
            data: formatFacebookSettings(updated),
        });
    } catch (error) {
        console.error("PUT /api/admin/facebook-settings error:", error);

        return Response.json(
            { success: false, message: "Failed to update Facebook settings." },
            { status: 500 }
        );
    }
}