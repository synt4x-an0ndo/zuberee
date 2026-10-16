import prisma from "@/directory/prisma/prisma.js";
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

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const shippingCosts = await prisma.shippingCost.findMany({
            orderBy: { createdAt: "desc" },
        });

        return Response.json({
            data: shippingCosts.map(formatShippingCost),
        });
    } catch (error) {
        console.error("Get shipping costs API error:", error);

        return Response.json(
            { success: false, message: "Failed to load shipping costs." },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const body = await request.json();

        const {
            inside_dhaka,
            outside_dhaka,
            one_shipping_cost,
            insideDhaka,
            outsideDhaka,
            oneShippingCost,
        } = body;

        const finalInside = inside_dhaka ?? insideDhaka;
        const finalOutside = outside_dhaka ?? outsideDhaka;
        const finalOne = one_shipping_cost ?? oneShippingCost ?? null;

        if (
            finalInside === undefined ||
            finalOutside === undefined ||
            Number.isNaN(Number(finalInside)) ||
            Number.isNaN(Number(finalOutside))
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Inside and outside Dhaka costs required.",
                },
                { status: 400 }
            );
        }

        const created = await prisma.shippingCost.create({
            data: {
                insideDhaka: Number(finalInside),
                outsideDhaka: Number(finalOutside),
                oneShippingCost:
                    finalOne === null ? null : Number(finalOne),
            },
        });

        return Response.json(
            {
                success: true,
                message: "Shipping cost updated.",
                data: formatShippingCost(created),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create shipping cost API error:", error);

        return Response.json(
            { success: false, message: "Failed to save shipping cost." },
            { status: 500 }
        );
    }
}