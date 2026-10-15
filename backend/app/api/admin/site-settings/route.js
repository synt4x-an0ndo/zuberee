import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatSiteSettings(s) {
    return {
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
            primary_color,
            primaryColor,
            inventory_enforcement_enabled,
            inventoryEnforcementEnabled,
            low_stock_threshold,
            lowStockThreshold,
        } = body;

        const updateData = {};

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