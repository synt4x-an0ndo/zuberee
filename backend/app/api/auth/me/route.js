import { authenticateRequest } from "@/directory/auth/auth.js";
import { getUserRolesAndPermissions } from "@/lib/permissions.js";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return Response.json({ success: false, message: auth.message, data: null }, { status: 401 });
    }
    const access = await getUserRolesAndPermissions(auth.user.userId);
    return Response.json({ success: true, message: "Authenticated user.", data: { ...auth.user, ...access } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Authorization lookup failed:", error);
    return Response.json({ success: false, message: "Authorization service unavailable.", data: null }, { status: 503 });
  }
}
