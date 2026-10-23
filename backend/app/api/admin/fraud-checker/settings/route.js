import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function maskApiKey(key) {
    if (!key) return null;

    if (key.length <= 4) return "••••";

    return "••••" + key.slice(-4);
}

function formatSettings(s) {
    return {
        is_active: s.isActive,
        cache_minutes: s.cacheMinutes,
        has_api_key: !!s.apiKey,
        api_key_hint: maskApiKey(s.apiKey),
        provider_url: s.providerUrl,
    };
}

async function getOrCreateSettings() {
    let settings = await prisma.fraudCheckerSettings.findFirst({
        orderBy: { createdAt: "asc" },
    });

    if (!settings) {
        settings = await prisma.fraudCheckerSettings.create({
            data: {
                isActive: true,
                cacheMinutes: 60,
                providerUrl: "https://api.bdcourier.com/courier-check",
            },
        });
    }

    return settings;
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const settings = await getOrCreateSettings();

        return Response.json({
            data: formatSettings(settings),
        });
    } catch (error) {
        console.error("Get fraud checker settings API error:", error);

        return Response.json(
            { success: false, message: "Failed to load settings." },
            { status: 500 }
        );
    }
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
            is_active,
            isActive,
            cache_minutes,
            cacheMinutes,
            api_key,
            apiKey,
            provider_url,
            providerUrl,
        } = body;

        const updateData = {};

        const finalActive = is_active ?? isActive;
        if (finalActive !== undefined) {
            updateData.isActive = Boolean(finalActive);
        }

        const finalCache = cache_minutes ?? cacheMinutes;
        if (finalCache !== undefined) {
            const parsed = Number(finalCache);
            if (!Number.isInteger(parsed) || parsed < 0) {
                return Response.json(
                    {
                        success: false,
                        message: "cache_minutes must be a non-negative integer.",
                    },
                    { status: 400 }
                );
            }
            updateData.cacheMinutes = parsed;
        }

        const finalKey = api_key ?? apiKey;
        if (finalKey !== undefined) {
            if (finalKey === null || finalKey === "") {
                updateData.apiKey = null;
            } else if (typeof finalKey === "string") {
                updateData.apiKey = finalKey.trim();
            } else {
                return Response.json(
                    {
                        success: false,
                        message: "api_key must be a string or null.",
                    },
                    { status: 400 }
                );
            }
        }

        const finalUrl = provider_url ?? providerUrl;
        if (finalUrl !== undefined) {
            if (
                typeof finalUrl !== "string" ||
                !finalUrl.trim().startsWith("http")
            ) {
                return Response.json(
                    {
                        success: false,
                        message: "provider_url must be a valid URL.",
                    },
                    { status: 400 }
                );
            }
            updateData.providerUrl = finalUrl.trim();
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        const existing = await getOrCreateSettings();

        const updated = await prisma.fraudCheckerSettings.update({
            where: { id: existing.id },
            data: updateData,
        });

        return Response.json({
            data: formatSettings(updated),
        });
    } catch (error) {
        console.error("Update fraud checker settings API error:", error);

        return Response.json(
            { success: false, message: "Failed to update settings." },
            { status: 500 }
        );
    }
}