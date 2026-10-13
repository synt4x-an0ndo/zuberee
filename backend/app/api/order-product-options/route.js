import prisma from "../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                {
                    success: false,
                    message: "Admin access required.",
                },
                { status: 403 }
            );
        }

        const products = await prisma.product.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                sku: true,
            },
        });

        return Response.json({
            success: true,
            message: "Product options loaded.",
            data: products.map((p) => ({
                id: p.id,
                title: p.name,
                sku: p.sku,
            })),
        });
    } catch (error) {
        console.error("Order product options API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load products.",
            },
            { status: 500 }
        );
    }
}