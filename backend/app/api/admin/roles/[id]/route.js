import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { getUserRolesAndPermissions } from "@/lib/permissions.js";

function formatRole(role) {
    return {
        id: role.id,
        name: role.name,
        guard_name: role.guardName,
        created_at: role.createdAt,
        updated_at: role.updatedAt,
        permissions: role.permissions.map((rp) => ({
            id: rp.permission.id,
            name: rp.permission.name,
            guard_name: rp.permission.guardName,
        })),
    };
}

export async function PUT(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        const { permissions } = await getUserRolesAndPermissions(auth.user.userId);
        if (!permissions.includes("edit roles")) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const { id } = await params;
        const roleId = Number(id);

        if (!Number.isInteger(roleId) || roleId <= 0) {
            return Response.json({ status: false, message: "Invalid role ID." }, { status: 400 });
        }

        const existing = await prisma.role.findUnique({ where: { id: roleId } });
        if (!existing) {
            return Response.json({ status: false, message: "Role not found." }, { status: 404 });
        }

        let body = {};
        try { body = await request.json(); } catch {
            return Response.json({ status: false, message: "Request body required." }, { status: 400 });
        }

        const { name, permission_ids, permissionIds, permissions: perms } = body;
        const finalPermIds = permission_ids ?? permissionIds ?? perms;

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return Response.json({ status: false, message: "Invalid role name." }, { status: 400 });
            }

            if (name.trim() !== existing.name) {
                const dup = await prisma.role.findUnique({ where: { name: name.trim() } });
                if (dup) {
                    return Response.json({ status: false, message: "Role name already exists." }, { status: 409 });
                }
                await prisma.role.update({ where: { id: roleId }, data: { name: name.trim() } });
            }
        }

        if (Array.isArray(finalPermIds)) {
            const permIdsParsed = finalPermIds.map((p) => Number(p)).filter((p) => Number.isInteger(p) && p > 0);
            await prisma.$transaction(async (tx) => {
                await tx.rolePermission.deleteMany({ where: { roleId } });
                if (permIdsParsed.length > 0) {
                    await tx.rolePermission.createMany({
                        data: permIdsParsed.map((permId) => ({ roleId, permissionId: permId })),
                    });
                }
            });
        }

        const updated = await prisma.role.findUnique({
            where: { id: roleId },
            include: { permissions: { include: { permission: true } } },
        });

        return Response.json({ status: true, message: "Role updated.", data: formatRole(updated) });
    } catch (error) {
        console.error("Update role API error:", error);
        return Response.json({ status: false, message: "Failed to update role." }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        const { permissions } = await getUserRolesAndPermissions(auth.user.userId);
        if (!permissions.includes("delete roles")) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const { id } = await params;
        const roleId = Number(id);

        if (!Number.isInteger(roleId) || roleId <= 0) {
            return Response.json({ status: false, message: "Invalid role ID." }, { status: 400 });
        }

        const existing = await prisma.role.findUnique({ where: { id: roleId } });
        if (!existing) {
            return Response.json({ status: false, message: "Role not found." }, { status: 404 });
        }

        const usersWithRole = await prisma.userRole.count({ where: { roleId } });
        if (usersWithRole > 0) {
            return Response.json({ status: false, message: "Cannot delete role. Users still assigned." }, { status: 409 });
        }

        await prisma.role.delete({ where: { id: roleId } });
        return Response.json({ status: true, message: "Role deleted." });
    } catch (error) {
        console.error("Delete role API error:", error);
        return Response.json({ status: false, message: "Failed to delete role." }, { status: 500 });
    }
}