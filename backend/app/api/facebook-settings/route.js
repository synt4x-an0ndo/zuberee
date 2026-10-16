import prisma from "@/directory/prisma/prisma.js";

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

export async function GET() {
    try {
        const settings = await prisma.facebookSettings.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!settings) {
            return Response.json(
                { message: "Facebook settings not configured." },
                { status: 404 }
            );
        }

        return Response.json(formatFacebookSettings(settings));
    } catch (error) {
        console.error("GET /api/facebook-settings error:", error);

        return Response.json(
            { message: "Failed to fetch Facebook settings." },
            { status: 500 }
        );
    }
}