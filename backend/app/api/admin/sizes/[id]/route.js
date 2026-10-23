import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

function formatSize(size) {
    return {
        id: size.id,
        size: size.size,
        position: size.position,
        is_active: size.isActive,
        created_at: size.createdAt,
        updated_at: size.updatedAt,
    };
}

export async function PUT(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { message: "failed", data: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const sizeId = Number(id);

        if (!Number.isInteger(sizeId) || sizeId <= 0) {
            return Response.json(
                { message: "failed", data: "Invalid size ID." },
                { status: 400 }
            );
        }

        const existing = await prisma.size.findUnique({
            where: { id: sizeId },
        });

        if (!existing) {
            return Response.json(
                { message: "failed", data: "Size not found." },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { size, position, isActive, is_active } = body;

        const updateData = {};

        if (size !== undefined) {
            if (typeof size !== "string" || !size.trim()) {
                return Response.json(
                    {
                        message: "failed",
                        data: "Size cannot be empty.",
                    },
                    { status: 400 }
                );
            }

            const trimmed = size.trim();

            if (trimmed !== existing.size) {
                const duplicate = await prisma.size.findUnique({
                    where: { size: trimmed },
                });

                if (duplicate) {
                    return Response.json(
                        {
                            message: "failed",
                            data: "Size already exists.",
                        },
                        { status: 409 }
                    );
                }
            }

            updateData.size = trimmed;
        }

        if (position !== undefined) {
            updateData.position = Number(position) || 0;
        }

        const active = isActive ?? is_active;
        if (active !== undefined) {
            updateData.isActive = Boolean(active);
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                {
                    message: "failed",
                    data: "No valid fields to update.",
                },
                { status: 400 }
            );
        }

        const updated = await prisma.size.update({
            where: { id: sizeId },
            data: updateData,
        });

        return Response.json({
            message: "success",
            data: formatSize(updated),
        });
    } catch (error) {
        console.error("Update size API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { message: "failed", data: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const sizeId = Number(id);

        if (!Number.isInteger(sizeId) || sizeId <= 0) {
            return Response.json(
                { message: "failed", data: "Invalid size ID." },
                { status: 400 }
            );
        }

        const existing = await prisma.size.findUnique({
            where: { id: sizeId },
        });

        if (!existing) {
            return Response.json(
                { message: "failed", data: "Size not found." },
                { status: 404 }
            );
        }

        const inUse = await prisma.productVariant.count({
            where: { value: existing.size },
        });

        if (inUse > 0) {
            return Response.json(
                {
                    message: "failed",
                    data: "Size is used by existing products. Deactivate instead.",
                },
                { status: 409 }
            );
        }

        await prisma.size.delete({ where: { id: sizeId } });

        return Response.json({
            message: "success",
            data: null,
        });
    } catch (error) {
        console.error("Delete size API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}