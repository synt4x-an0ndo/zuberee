import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatAboutUs(a) {
    return {
        id: a.id,
        title: a.title,
        content: a.content,
        image: a.image,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
    };
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

        const { title, content, image } = body;

        const updateData = {};

        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return Response.json(
                    { success: false, message: "Title is required." },
                    { status: 400 }
                );
            }
            updateData.title = title.trim();
        }

        if (content !== undefined) {
            if (typeof content !== "string") {
                return Response.json(
                    { success: false, message: "Content must be a string." },
                    { status: 400 }
                );
            }
            updateData.content = content;
        }

        if (image !== undefined) {
            updateData.image =
                image === null || image === ""
                    ? null
                    : String(image).trim();
        }

        let existing = await prisma.aboutUs.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!existing) {
            if (!updateData.title || !updateData.content) {
                return Response.json(
                    {
                        success: false,
                        message: "Title and content required to create.",
                    },
                    { status: 400 }
                );
            }

            const created = await prisma.aboutUs.create({
                data: {
                    title: updateData.title,
                    content: updateData.content,
                    image: updateData.image ?? null,
                },
            });

            return Response.json(
                {
                    success: true,
                    message: "About us created.",
                    data: formatAboutUs(created),
                },
                { status: 201 }
            );
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                { success: false, message: "No valid fields to update." },
                { status: 400 }
            );
        }

        const updated = await prisma.aboutUs.update({
            where: { id: existing.id },
            data: updateData,
        });

        return Response.json({
            success: true,
            message: "About us updated.",
            data: formatAboutUs(updated),
        });
    } catch (error) {
        console.error("PUT /api/admin/about-us error:", error);

        return Response.json(
            { success: false, message: "Failed to update about us." },
            { status: 500 }
        );
    }
}