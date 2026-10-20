import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import {
    normalizeAiBaseUrl,
    normalizeAiModel,
    testAiApiKey,
} from "@/lib/aiProvider.js";

function formatSiteSettings(s) {
    return {
        site_name: s.siteName,
        ai_api_key_set: Boolean(s.aiApiKey || s.geminiApiKey),
        ai_api_base_url: s.aiApiBaseUrl ?? "",
        ai_api_model: s.aiApiModel ?? "",
        gemini_api_key_set: Boolean(s.geminiApiKey),
        favicon_path: s.faviconPath ?? null,
        favicon_zoom: s.faviconZoom ?? 85,
        logo_sizes: s.logoSizes ?? null,
        primary_color: s.primaryColor,
        inventory_enforcement_enabled:
        s.inventoryEnforcementEnabled,
        low_stock_threshold: s.lowStockThreshold,
    };
}

async function getOrCreate() {
    let settings = await prisma.siteSettings.findFirst({
        orderBy: { createdAt: "asc" },
    });

    if (!settings) {
        settings = await prisma.siteSettings.create({
            data: {
                primaryColor: "#092009",
                inventoryEnforcementEnabled: false,
                lowStockThreshold: 3,
            },
        });
    }

    return settings;
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const existing = await getOrCreate();

        return Response.json({
            success: true,
            data: formatSiteSettings(existing),
        });
    } catch (error) {
        console.error("GET /api/admin/site-settings error:", error);

        return Response.json(
            { success: false, message: "Failed to fetch site settings." },
            { status: 500 }
        );
    }
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
            site_name,
            siteName,
            favicon_path,
            faviconPath,
            favicon_zoom,
            faviconZoom,
            logo_sizes,
            logoSizes,
            ai_api_key,
            aiApiKey,
            ai_api_base_url,
            aiApiBaseUrl,
            ai_api_model,
            aiApiModel,
            gemini_api_key,
            geminiApiKey,
            primary_color,
            primaryColor,
            inventory_enforcement_enabled,
            inventoryEnforcementEnabled,
            low_stock_threshold,
            lowStockThreshold,
        } = body;

        const updateData = {};

        const finalName = site_name ?? siteName;
        if (finalName !== undefined) {
            if (typeof finalName !== "string" || !finalName.trim()) {
                return Response.json(
                    { success: false, message: "Store name (site_name) cannot be empty." },
                    { status: 400 }
                );
            }
            if (finalName.trim().length > 120) {
                return Response.json(
                    { success: false, message: "Store name (site_name) is too long (max 120 characters)." },
                    { status: 400 }
                );
            }
            updateData.siteName = finalName.trim();
        }

        const finalFavicon = favicon_path ?? faviconPath;
        if (finalFavicon !== undefined) {
            updateData.faviconPath =
                finalFavicon === null || finalFavicon === ""
                    ? null
                    : String(finalFavicon).trim();
        }

        const finalZoom = favicon_zoom ?? faviconZoom;
        if (finalZoom !== undefined) {
            const parsedZoom = Number(finalZoom);
            if (!Number.isInteger(parsedZoom) || parsedZoom < 40 || parsedZoom > 100) {
                return Response.json(
                    { success: false, message: "favicon_zoom must be a whole number between 40 and 100." },
                    { status: 400 }
                );
            }
            updateData.faviconZoom = parsedZoom;
        }

        const finalSizes = logo_sizes ?? logoSizes;
        if (finalSizes !== undefined) {
            if (finalSizes === null || typeof finalSizes !== "object" || Array.isArray(finalSizes)) {
                return Response.json(
                    { success: false, message: "logo_sizes must be an object." },
                    { status: 400 }
                );
            }
            // Per-placement logo boxes: { header: { width, height }, ... }.
            // Unknown placements are dropped; each dimension, when present,
            // must be a sane pixel size. Missing dimensions are simply not
            // stored — the frontend falls back to its defaults for them.
            const PLACEMENTS = ["header", "footer", "auth", "adminSidebar", "adminLogin", "invoice"];
            const sanitized = {};
            for (const key of PLACEMENTS) {
                const entry = finalSizes[key];
                if (!entry || typeof entry !== "object") continue;
                const clean = {};
                for (const dim of ["width", "height"]) {
                    if (entry[dim] === undefined) continue;
                    const parsed = Number(entry[dim]);
                    const max = dim === "width" ? 800 : 400;
                    if (!Number.isInteger(parsed) || parsed < 8 || parsed > max) {
                        return Response.json(
                            { success: false, message: `logo_sizes.${key}.${dim} must be a whole number between 8 and ${max}.` },
                            { status: 400 }
                        );
                    }
                    clean[dim] = parsed;
                }
                if (Object.keys(clean).length > 0) sanitized[key] = clean;
            }
            updateData.logoSizes = sanitized;
        }

        // AI API configuration (server-only secret): undefined = keep the
        // stored value, "" = remove it, otherwise replace it. A non-empty
        // candidate is tested before it is saved, so a bad key can never
        // disconnect the API that is already working. The key itself is
        // never returned by any endpoint — only ai_api_key_set is.
        const finalKey =
            ai_api_key ?? aiApiKey ?? gemini_api_key ?? geminiApiKey;
        const finalBaseUrl = ai_api_base_url ?? aiApiBaseUrl;
        const finalModel = ai_api_model ?? aiApiModel;
        const aiConfigChanged =
            finalKey !== undefined ||
            finalBaseUrl !== undefined ||
            finalModel !== undefined;

        if (aiConfigChanged) {
            const existingAi = await getOrCreate();
            const previousKeySet = Boolean(
                existingAi.aiApiKey || existingAi.geminiApiKey
            );

            let candidateBaseUrl = "";
            let candidateModel = "";
            try {
                candidateBaseUrl =
                    finalBaseUrl === undefined
                        ? existingAi.aiApiBaseUrl || ""
                        : normalizeAiBaseUrl(finalBaseUrl);
                candidateModel =
                    finalModel === undefined
                        ? existingAi.aiApiModel || ""
                        : normalizeAiModel(finalModel);
            } catch (error) {
                return Response.json(
                    { success: false, message: error.message },
                    { status: 400 }
                );
            }

            const candidateKey =
                finalKey === undefined
                    ? existingAi.aiApiKey || existingAi.geminiApiKey || ""
                    : finalKey === null || finalKey === ""
                      ? ""
                      : String(finalKey).trim();

            if (candidateKey) {
                const connection = await testAiApiKey(candidateKey, {
                    baseUrl: candidateBaseUrl,
                    model: candidateModel,
                });
                if (!connection.ok) {
                    const status =
                        connection.status === 0 ||
                        connection.status === 429 ||
                        connection.status >= 500
                            ? 503
                            : 400;
                    const keepMessage = previousKeySet
                        ? " The new API was not saved; your previous API is still active."
                        : " The API was not saved.";
                    const reason =
                        connection.status === 422
                            ? connection.detail ||
                              "The API configuration is incomplete."
                            : connection.status === 401 ||
                                connection.status === 403
                              ? "AI Assistant disconnected — the API key was rejected. Create a fresh key and paste the complete key."
                              : connection.status === 404
                                ? "AI Assistant disconnected — the automatic model is not available to this API key."
                                : connection.status === 429
                                  ? "AI Assistant disconnected — the API is rate-limited or out of quota. Wait a moment and try Save again."
                                  : connection.status === 0
                                    ? "AI Assistant disconnected — the API could not be reached from this PC."
                                    : connection.status >= 500
                                      ? "AI Assistant disconnected — the API is temporarily unavailable."
                                      : "AI Assistant disconnected — the API rejected the test request.";
                    return Response.json(
                        {
                            success: false,
                            code: "AI_CONNECTION_FAILED",
                            message: `${reason}${keepMessage}`,
                            provider_status: connection.status,
                        },
                        { status }
                    );
                }
            }

            updateData.aiApiKey = candidateKey || null;
            // Keep the legacy column in sync so an older build never
            // resurrects a removed/replaced key as a fallback.
            updateData.geminiApiKey = candidateKey || null;
            updateData.aiApiBaseUrl = candidateBaseUrl || null;
            updateData.aiApiModel = candidateModel || null;
        }

        const finalColor = primary_color ?? primaryColor;
        if (finalColor !== undefined) {
            if (typeof finalColor !== "string" || !finalColor.trim()) {
                return Response.json(
                    { success: false, message: "Invalid primary color." },
                    { status: 400 }
                );
            }
            updateData.primaryColor = finalColor.trim();
        }

        const finalEnforce =
            inventory_enforcement_enabled ??
            inventoryEnforcementEnabled;
        if (finalEnforce !== undefined) {
            updateData.inventoryEnforcementEnabled =
                Boolean(finalEnforce);
        }

        const finalThreshold =
            low_stock_threshold ?? lowStockThreshold;
        if (finalThreshold !== undefined) {
            const parsed = Number(finalThreshold);
            if (!Number.isInteger(parsed) || parsed < 0) {
                return Response.json(
                    {
                        success: false,
                        message:
                            "low_stock_threshold must be a non-negative integer.",
                    },
                    { status: 400 }
                );
            }
            updateData.lowStockThreshold = parsed;
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        const existing = await getOrCreate();

        const updated = await prisma.siteSettings.update({
            where: { id: existing.id },
            data: updateData,
        });

        return Response.json({
            success: true,
            message: "Site settings updated.",
            data: formatSiteSettings(updated),
        });
    } catch (error) {
        console.error("PUT /api/admin/site-settings error:", error);

        return Response.json(
            { success: false, message: "Failed to update site settings." },
            { status: 500 }
        );
    }
}