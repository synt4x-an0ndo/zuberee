import prisma from "../../../../directory/prisma/prisma.js";
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
            created_at: rp.permission.createdAt,
            updated_at: rp.permission.updatedAt,
            pivot: { role_id: role.id, permission_id: rp.permission.id },
        })),
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        const { permissions } = await getUserRolesAndPermissions(auth.user.userId);
        if (!permissions.includes("view roles")) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const roles = await prisma.role.findMany({
            orderBy: { id: "asc" },
            include: { permissions: { include: { permission: true } } },
        });

        return Response.json({ status: true, roles: roles.map(formatRole) });
    } catch (error) {
        console.error("Get roles API error:", error);
        return Response.json({ status: false, message: "Failed to load roles." }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        const { permissions } = await getUserRolesAndPermissions(auth.user.userId);
        if (!permissions.includes("create roles")) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        let body = {};
        try { body = await request.json(); } catch {
            return Response.json({ status: false, message: "Request body required." }, { status: 400 });
        }

        const { name, permission_ids, permissionIds, permissions: perms } = body;
        const finalPermIds = permission_ids ?? permissionIds ?? perms ?? [];

        if (!name || typeof name !== "string" || !name.trim()) {
            return Response.json({ status: false, message: "Role name is required." }, { status: 400 });
        }

        const existing = await prisma.role.findUnique({ where: { name: name.trim() } });
        if (existing) {
            return Response.json({ status: false, message: "Role already exists." }, { status: 409 });
        }

        const permIdsParsed = finalPermIds.map((p) => Number(p)).filter((p) => Number.isInteger(p) && p > 0);

        const role = await prisma.role.create({
            data: { name: name.trim(), guardName: "sanctum" },
        });

        if (permIdsParsed.length > 0) {
            await prisma.rolePermission.createMany({
                data: permIdsParsed.map((permId) => ({ roleId: role.id, permissionId: permId })),
            });
        }

        const created = await prisma.role.findUnique({
            where: { id: role.id },
            include: { permissions: { include: { permission: true } } },
        });

        return Response.json({ status: true, message: "Role created.", data: formatRole(created) }, { status: 201 });
    } catch (error) {
        console.error("Create role API error:", error);
        return Response.json({ status: false, message: "Failed to create role." }, { status: 500 });
    }
}