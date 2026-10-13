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

        const districts = await prisma.order.findMany({
            where: {
                district: { not: null },
            },
            select: { district: true },
            distinct: ["district"],
            orderBy: { district: "asc" },
        });

        const list = districts
            .map((d) => d.district)
            .filter(Boolean);

        return Response.json({
            success: true,
            message: "Districts loaded.",
            data: list,
        });
    } catch (error) {
        console.error("Order districts API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load districts.",
            },
            { status: 500 }
        );
    }
}