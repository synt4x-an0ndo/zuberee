import prisma from "../../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import {
    ROLE_DEFINITIONS,
    getDisplayRoleDefinition,
    isAdminRole,
    roleFromIds,
} from "@/lib/access.js";

/**
 * PATCH /api/admin/users/:id/roles
 *
 * The admin UI still sends a list of role ids (that is what its modal already
 * builds), but a user holds exactly one role, so the strongest id wins:
 * 1 = Admin, 2 = Moderator, anything else = Customer.
 */
export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        if (!isAdminRole(auth.user.role)) {
            return Response.json({ status: false, message: "Permission denied." }, { status: 403 });
        }

        const { id } = await params;
        const userId = Number(id);

        if (!Number.isInteger(userId) || userId <= 0) {
            return Response.json({ status: false, message: "Invalid user ID." }, { status: 400 });
        }

        if (userId === auth.user.userId) {
            return Response.json(
                { status: false, message: "You cannot change your own role. Ask another admin." },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });
        if (!user) {
            return Response.json({ status: false, message: "User not found." }, { status: 404 });
        }

        let body = {};
        try {
            body = await request.json();
        } catch {
            return Response.json({ status: false, message: "Request body required." }, { status: 400 });
        }

        const { role_ids, roleIds, roles } = body;
        const submitted = role_ids ?? roleIds ?? roles;

        if (!Array.isArray(submitted)) {
            return Response.json({ status: false, message: "role_ids must be an array." }, { status: 400 });
        }

        const parsed = submitted
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0);

        const known = new Set(ROLE_DEFINITIONS.map((entry) => entry.id));
        if (parsed.some((value) => !known.has(value))) {
            return Response.json({ status: false, message: "One or more roles not found." }, { status: 404 });
        }

        const nextRole = roleFromIds(parsed);
        const updated = await prisma.user.update({
            where: { id: userId },
            data: { role: nextRole },
            select: { id: true, name: true, email: true, role: true },
        });

        const definition = getDisplayRoleDefinition(updated.role);

        return Response.json({
            status: true,
            message: "Role assigned.",
            data: {
                id: updated.id,
                name: updated.name,
                email: updated.email,
                roles: [
                    {
                        id: definition.id,
                        name: definition.name,
                        label: definition.label,
                        guard_name: "sanctum",
                    },
                ],
            },
        });
    } catch (error) {
        console.error("Assign role API error:", error);
        return Response.json({ status: false, message: "Failed to assign role." }, { status: 500 });
    }
}
