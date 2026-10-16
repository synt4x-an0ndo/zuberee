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

export async function PUT(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const shippingCostId = Number(id);

        if (!Number.isInteger(shippingCostId) || shippingCostId <= 0) {
            return Response.json(
                { success: false, message: "Invalid shipping cost ID." },
                { status: 400 }
            );
        }

        const existing = await prisma.shippingCost.findUnique({
            where: { id: shippingCostId },
        });

        if (!existing) {
            return Response.json(
                { success: false, message: "Shipping cost not found." },
                { status: 404 }
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
            inside_dhaka,
            outside_dhaka,
            one_shipping_cost,
            insideDhaka,
            outsideDhaka,
            oneShippingCost,
        } = body;

        const updateData = {};

        const finalInside = inside_dhaka ?? insideDhaka;
        const finalOutside = outside_dhaka ?? outsideDhaka;

        const hasOneCost =
            one_shipping_cost !== undefined ||
            oneShippingCost !== undefined;

        if (finalInside !== undefined) {
            if (
                finalInside === null ||
                finalInside === "" ||
                Number.isNaN(Number(finalInside)) ||
                Number(finalInside) < 0
            ) {
                return Response.json(
                    { success: false, message: "Invalid inside_dhaka value." },
                    { status: 400 }
                );
            }
            updateData.insideDhaka = Number(finalInside);
        }

        if (finalOutside !== undefined) {
            if (
                finalOutside === null ||
                finalOutside === "" ||
                Number.isNaN(Number(finalOutside)) ||
                Number(finalOutside) < 0
            ) {
                return Response.json(
                    { success: false, message: "Invalid outside_dhaka value." },
                    { status: 400 }
                );
            }
            updateData.outsideDhaka = Number(finalOutside);
        }

        if (hasOneCost) {
            const rawOne = one_shipping_cost ?? oneShippingCost;

            if (
                rawOne === null ||
                rawOne === undefined ||
                rawOne === ""
            ) {
                updateData.oneShippingCost = null;
            } else {
                if (Number.isNaN(Number(rawOne)) || Number(rawOne) < 0) {
                    return Response.json(
                        {
                            success: false,
                            message: "Invalid one_shipping_cost value.",
                        },
                        { status: 400 }
                    );
                }
                updateData.oneShippingCost = Number(rawOne);
            }
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        const updated = await prisma.shippingCost.update({
            where: { id: shippingCostId },
            data: updateData,
        });

        return Response.json({
            success: true,
            message: "Shipping cost updated.",
            data: formatShippingCost(updated),
        });
    } catch (error) {
        console.error("Update shipping cost API error:", error);

        return Response.json(
            { success: false, message: "Failed to update shipping cost." },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const shippingCostId = Number(id);

        if (!Number.isInteger(shippingCostId) || shippingCostId <= 0) {
            return Response.json(
                { success: false, message: "Invalid shipping cost ID." },
                { status: 400 }
            );
        }

        const existing = await prisma.shippingCost.findUnique({
            where: { id: shippingCostId },
        });

        if (!existing) {
            return Response.json(
                { success: false, message: "Shipping cost not found." },
                { status: 404 }
            );
        }

        const totalCount = await prisma.shippingCost.count();

        if (totalCount <= 1) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Cannot delete the only shipping cost entry. Create a new one first.",
                },
                { status: 409 }
            );
        }

        await prisma.shippingCost.delete({
            where: { id: shippingCostId },
        });

        return Response.json({
            success: true,
            message: "Shipping cost deleted.",
        });
    } catch (error) {
        console.error("Delete shipping cost API error:", error);

        return Response.json(
            { success: false, message: "Failed to delete shipping cost." },
            { status: 500 }
        );
    }
}