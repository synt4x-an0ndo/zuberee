import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

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

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { message: "failed", data: "Admin access required." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status")?.trim() ?? "all";

        const where = {
            ...(search
                ? {
                    size: {
                        contains: search,
                        mode: "insensitive",
                    },
                }
                : {}),

            ...(status === "active"
                ? { isActive: true }
                : status === "inactive"
                    ? { isActive: false }
                    : {}),
        };

        const sizes = await prisma.size.findMany({
            where,
            orderBy: [{ position: "asc" }, { id: "asc" }],
        });

        return Response.json({
            message: "success",
            data: sizes.map(formatSize),
        });
    } catch (error) {
        console.error("Get admin sizes API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                { message: "failed", data: "Admin access required." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { size, position, isActive, is_active } = body;

        if (!size || typeof size !== "string" || !size.trim()) {
            return Response.json(
                { message: "failed", data: "Size is required." },
                { status: 400 }
            );
        }

        const trimmed = size.trim();

        const existing = await prisma.size.findUnique({
            where: { size: trimmed },
        });

        if (existing) {
            return Response.json(
                { message: "failed", data: "Size already exists." },
                { status: 409 }
            );
        }

        let finalPosition = position;

        if (finalPosition === undefined || finalPosition === null) {
            const maxPosition = await prisma.size.aggregate({
                _max: { position: true },
            });
            finalPosition = (maxPosition._max.position ?? 0) + 1;
        }

        const created = await prisma.size.create({
            data: {
                size: trimmed,
                position: Number(finalPosition) || 0,
                isActive:
                    isActive !== undefined
                        ? Boolean(isActive)
                        : is_active !== undefined
                            ? Boolean(is_active)
                            : true,
            },
        });

        return Response.json(
            {
                message: "success",
                data: formatSize(created),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create size API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}