import prisma from "@/directory/prisma/prisma.js";

function formatSiteSettings(s) {
    return {
        site_name: s.siteName,
        favicon_path: s.faviconPath ?? null,
        favicon_zoom: s.faviconZoom ?? 85,
        logo_sizes: s.logoSizes ?? null,
        primary_color: s.primaryColor,
        inventory_enforcement_enabled:
        s.inventoryEnforcementEnabled,
        low_stock_threshold: s.lowStockThreshold,
    };
}

export async function GET() {
    try {
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

        return Response.json({
            data: formatSiteSettings(settings),
        });
    } catch (error) {
        console.error("GET /api/site-settings error:", error);

        return Response.json(
            { message: "Failed to fetch site settings." },
            { status: 500 }
        );
    }
}