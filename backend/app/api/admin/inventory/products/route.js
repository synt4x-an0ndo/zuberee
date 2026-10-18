import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json({ message: "Admin access required." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim();

        const products = await prisma.product.findMany({
            where: search ? {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { sku: { contains: search, mode: "insensitive" } },
                ],
            } : {},
            take: 20,
            select: {
                id: true,
                name: true,
                sku: true,
                inventory: { select: { trackInventory: true } }
            }
        });

        return Response.json({
            message: "success",
            data: products.map(p => ({
                id: p.id,
                title: p.name,
                sku: p.sku,
                track_inventory: p.inventory?.trackInventory ?? false,
            })),
        });
    } catch (error) {
        console.error("Get products for inventory API error:", error);
        return Response.json({ message: "Failed to load products." }, { status: 500 });
    }
}