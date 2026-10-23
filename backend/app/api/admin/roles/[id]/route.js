import { authenticateRequest } from "@/directory/auth/auth.js";
import { ROLE_DEFINITIONS, isAdminRole, permissionsForRole } from "@/lib/access.js";

function formatRole(definition) {
    return {
        id: definition.id,
        name: definition.name,
        label: definition.label,
        guard_name: "sanctum",
        created_at: null,
        updated_at: null,
        permissions: permissionsForRole(definition.role).map((name, index) => ({
            id: index + 1,
            name,
            guard_name: "sanctum",
            created_at: null,
            updated_at: null,
        })),
    };
}

export async function GET(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        if (!isAdminRole(auth.user.role)) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const { id } = await params;
        const definition = ROLE_DEFINITIONS.find((entry) => entry.id === Number(id));

        if (!definition) {
            return Response.json({ status: false, message: "Role not found." }, { status: 404 });
        }

        return Response.json({ status: true, role: formatRole(definition) });
    } catch (error) {
        console.error("Get role API error:", error);
        return Response.json({ status: false, message: "Failed to load role." }, { status: 500 });
    }
}

const FIXED = {
    status: false,
    message: "Roles are fixed to Admin and Moderator. Change a user's role from the Users page instead.",
};

export async function PUT() {
    return Response.json(FIXED, { status: 405 });
}

export async function DELETE() {
    return Response.json(FIXED, { status: 405 });
}
