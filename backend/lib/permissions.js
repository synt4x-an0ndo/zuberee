import prisma from "../directory/prisma/prisma.js";

export async function getUserRolesAndPermissions(userId) {
    const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
            role: {
                include: {
                    permissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            },
        },
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const permissions = new Set();

    for (const ur of userRoles) {
        for (const rp of ur.role.permissions) {
            permissions.add(rp.permission.name);
        }
    }

    return {
        roles,
        permissions: Array.from(permissions),
    };
}

export function hasPermission(permissions, permissionName) {
    return permissions.includes(permissionName);
}