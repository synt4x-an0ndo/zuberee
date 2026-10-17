import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json({ status: false, message: "Auth required." }, { status: 401 });
        }

        const permissions = await prisma.permission.findMany({
            orderBy: { id: "asc" },
        });

        return Response.json({
            status: true,
            permissions: permissions.map((p) => ({
                id: p.id,
                name: p.name,
                guard_name: p.guardName,
                created_at: p.createdAt,
                updated_at: p.updatedAt,
            })),
        });
    } catch (error) {
        console.error("Get permissions API error:", error);
        return Response.json({ status: false, message: "Failed to load permissions." }, { status: 500 });
    }
}