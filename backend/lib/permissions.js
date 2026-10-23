import prisma from "../directory/prisma/prisma.js";
import { permissionsForRole, roleNamesForRole } from "./access.js";

/**
 * Effective roles and permissions for a user.
 *
 * Reads `users.role` and nothing else, so a role change takes effect on the
 * very next request with no cache to clear.
 */
export async function getUserRolesAndPermissions(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (!user) {
        return { roles: [], permissions: [] };
    }

    return {
        roles: roleNamesForRole(user.role),
        permissions: permissionsForRole(user.role),
    };
}

export function hasPermission(permissions, permissionName) {
    return permissions.includes(permissionName);
}
