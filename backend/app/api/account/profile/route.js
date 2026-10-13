import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

export async function PUT(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Spec: only name + phone are updatable.
        // email / role / passwordHash are never updated here.
        const { name, phone } = body;

        const updateData = {};

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "Name must be a non-empty string.",
                        data: null,
                    },
                    { status: 400 }
                );
            }

            updateData.name = name.trim();
        }

        if (phone !== undefined) {
            if (phone !== null && typeof phone !== "string") {
                return Response.json(
                    {
                        success: false,
                        message: "Phone must be a string or null.",
                        data: null,
                    },
                    { status: 400 }
                );
            }

            updateData.phone =
                phone === null || phone.trim() === ""
                    ? null
                    : phone.trim();
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                {
                    success: false,
                    message:
                        "At least one field (name or phone) is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const updatedUser = await prisma.user.update({
            where: { id: auth.user.userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return Response.json(
            {
                success: true,
                message: "Profile updated successfully.",
                data: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    phone: updatedUser.phone,
                    image: updatedUser.image,
                    role: updatedUser.role.toLowerCase(),
                    joined_at: updatedUser.createdAt,
                    updated_at: updatedUser.updatedAt,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update profile API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to update profile.",
                data: null,
            },
            { status: 500 }
        );
    }
}