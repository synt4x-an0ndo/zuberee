import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { getDisplayRoleDefinition, isAdminRole, parseModeratorPermissions } from "@/lib/access.js";

function formatUser(user) {
    const definition = getDisplayRoleDefinition(user.role);

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        email_verified_at: null,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        moderator_permissions: parseModeratorPermissions(user.moderatorPermissions),
        // The role now comes from users.role - no join, no pivot table.
        roles: [
            {
                id: definition.id,
                name: definition.name,
                label: definition.label,
                guard_name: "sanctum",
                created_at: null,
                updated_at: null,
                pivot: {
                    model_type: "User",
                    model_id: user.id,
                    role_id: definition.id,
                },
            },
        ],
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

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                moderatorPermissions: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return Response.json({
            status: true,
            users: users.map(formatUser),
        });
    } catch (error) {
        console.error("Get users API error:", error);
        return Response.json({ status: false, message: "Failed to load users." }, { status: 500 });
    }
}
