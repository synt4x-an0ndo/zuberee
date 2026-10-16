import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { key } = await params;
        const decoded = decodeURIComponent(key);

        const [type, id] = decoded.split(":");

        if (!type || !id) {
            return Response.json(
                { success: false, message: "Invalid customer key." },
                { status: 400 }
            );
        }

        let body = {};

        try {
            body = await request.json();
        } catch {
            return Response.json(
                { success: false, message: "Request body is required." },
                { status: 400 }
            );
        }

        const { badge } = body;

        let finalBadge = null;

        if (badge !== null && badge !== undefined) {
            if (typeof badge !== "string" || !badge.trim()) {
                return Response.json(
                    { success: false, message: "Badge must be a string or null." },
                    { status: 400 }
                );
            }

            finalBadge = badge.trim();
        }

        if (type === "user") {
            const userId = Number(id);

            if (!Number.isInteger(userId) || userId <= 0) {
                return Response.json(
                    { success: false, message: "Invalid user ID." },
                    { status: 400 }
                );
            }

            await prisma.user.update({
                where: { id: userId },
                data: { badge: finalBadge },
            });
        } else if (type === "guest") {
            await prisma.order.updateMany({
                where: { guestPhone: id, userId: null },
                data: { assignedBadge: finalBadge },
            });
        } else {
            return Response.json(
                { success: false, message: "Invalid customer type." },
                { status: 400 }
            );
        }

        return Response.json({
            success: true,
            message: "Badge updated.",
            data: {
                key: decoded,
                badge: finalBadge,
            },
        });
    } catch (error) {
        console.error("Update badge API error:", error);

        return Response.json(
            { success: false, message: "Failed to update badge." },
            { status: 500 }
        );
    }
}