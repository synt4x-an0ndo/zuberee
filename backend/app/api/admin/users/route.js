import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { getUserRolesAndPermissions } from "@/lib/permissions.js";

function formatUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified_at: null,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        roles: user.userRoles.map((ur) => ({
            id: ur.role.id,
            name: ur.role.name,
            guard_name: ur.role.guardName,
            created_at: ur.role.createdAt,
            updated_at: ur.role.updatedAt,
            pivot: {
                model_type: "User",
                model_id: user.id,
                role_id: ur.role.id,
            },
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
        if (!permissions.includes("view users")) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "asc" },
            include: {
                userRoles: {
                    include: {
                        role: true,
                    },
                },
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