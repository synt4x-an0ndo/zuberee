import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatShippingCost(s) {
    return {
        id: s.id,
        inside_dhaka: Number(s.insideDhaka),
        outside_dhaka: Number(s.outsideDhaka),
        one_shipping_cost:
            s.oneShippingCost === null
                ? null
                : Number(s.oneShippingCost),
        created_at: s.createdAt,
        updated_at: s.updatedAt,
    };
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

        let latest = await prisma.shippingCost.findFirst({
            orderBy: { createdAt: "desc" },
        });

        if (!latest) {
            latest = await prisma.shippingCost.create({
                data: {
                    insideDhaka: 80,
                    outsideDhaka: 150,
                    oneShippingCost: null,
                },
            });
        }

        return Response.json(formatShippingCost(latest));
    } catch (error) {
        console.error("Shipping costs latest API error:", error);

        return Response.json(
            { success: false, message: "Failed to load shipping costs." },
            { status: 500 }
        );
    }
}