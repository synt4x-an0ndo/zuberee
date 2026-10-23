import { authenticateRequest } from "@/directory/auth/auth.js";
import { ALL_PERMISSIONS, isAdminRole } from "@/lib/access.js";

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
            permissions: ALL_PERMISSIONS.map((name, index) => ({
                id: index + 1,
                name,
                guard_name: "sanctum",
                created_at: null,
                updated_at: null,
            })),
        });
    } catch (error) {
        console.error("Get permissions API error:", error);
        return Response.json({ status: false, message: "Failed to load permissions." }, { status: 500 });
    }
}
