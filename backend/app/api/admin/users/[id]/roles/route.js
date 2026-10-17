import prisma from "../../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { getUserRolesAndPermissions } from "@/lib/permissions.js";

export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        const { permissions } = await getUserRolesAndPermissions(auth.user.userId);
        if (!permissions.includes("assign roles")) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const { id } = await params;
        const userId = Number(id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return Response.json({ status: false, message: "Invalid user ID." }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return Response.json({ status: false, message: "User not found." }, { status: 404 });
        }

        let body = {};
        try { body = await request.json(); } catch {
            return Response.json({ status: false, message: "Request body required." }, { status: 400 });
        }

        const { role_ids, roleIds, roles } = body;
        const finalRoleIds = role_ids ?? roleIds ?? roles;

        if (!Array.isArray(finalRoleIds)) {
            return Response.json({ status: false, message: "role_ids must be an array." }, { status: 400 });
        }

        const roleIdsParsed = finalRoleIds.map((r) => Number(r)).filter((r) => Number.isInteger(r) && r > 0);
        const existingRoles = await prisma.role.findMany({ where: { id: { in: roleIdsParsed } } });

        if (existingRoles.length !== roleIdsParsed.length) {
            return Response.json({ status: false, message: "One or more roles not found." }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.userRole.deleteMany({ where: { userId } });
            if (roleIdsParsed.length > 0) {
                await tx.userRole.createMany({
                    data: roleIdsParsed.map((roleId) => ({ userId, roleId })),
                });
            }
        });

        const updated = await prisma.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } },
        });

        return Response.json({
            status: true,
            message: "Roles assigned.",
            data: {
                id: updated.id,
                name: updated.name,
                email: updated.email,
                roles: updated.userRoles.map((ur) => ({
                    id: ur.role.id,
                    name: ur.role.name,
                    guard_name: ur.role.guardName,
                })),
            },
        });
    } catch (error) {
        console.error("Assign roles API error:", error);
        return Response.json({ status: false, message: "Failed to assign roles." }, { status: 500 });
    }
}