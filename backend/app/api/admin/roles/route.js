import { authenticateRequest } from "@/directory/auth/auth.js";
import { ROLE_DEFINITIONS, isAdminRole, permissionsForRole } from "@/lib/access.js";

/**
 * The role list is fixed to Admin and Moderator (plus Customer, which the
 * admin UI shows so an account can be demoted back). Roles are not stored in
 * a separate table any more - the only record is `users.role`.
 */

function formatRole(definition) {
    const permissions = permissionsForRole(definition.role);

    return {
        id: definition.id,
        name: definition.name,
        label: definition.label,
        guard_name: "sanctum",
        created_at: null,
        updated_at: null,
        permissions: permissions.map((name, index) => ({
            id: index + 1,
            name,
            guard_name: "sanctum",
            created_at: null,
            updated_at: null,
        })),
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        if (!isAdminRole(auth.user.role)) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        return Response.json({
            status: true,
            roles: ROLE_DEFINITIONS.map(formatRole),
        });
    } catch (error) {
        console.error("Get roles API error:", error);
        return Response.json({ status: false, message: "Failed to load roles." }, { status: 500 });
    }
}

/** Roles are fixed: assigning one to a user is the only supported change. */
export async function POST() {
    return Response.json(
        {
            status: false,
            message: "Roles are fixed to Admin and Moderator. Change a user's role from the Users page instead.",
        },
        { status: 405 }
    );
}
