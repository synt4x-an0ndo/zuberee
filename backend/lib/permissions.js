import prisma from "../directory/prisma/prisma.js";
import { effectivePermissions, roleNamesForRole } from "./access.js";

/**
 * Effective roles and permissions for a user.
 *
 * Reads `users.role` (plus `users.moderatorPermissions` for moderators) and
 * nothing else, so a role change takes effect on the very next request with no
 * cache to clear.
 */
export async function getUserRolesAndPermissions(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, moderatorPermissions: true },
    });

    if (!user) {
        return { roles: [], permissions: [] };
    }

    return {
        roles: roleNamesForRole(user.role),
        permissions: effectivePermissions(user.role, user.moderatorPermissions),
    };
}

export function hasPermission(permissions, permissionName) {
    return permissions.includes(permissionName);
}
