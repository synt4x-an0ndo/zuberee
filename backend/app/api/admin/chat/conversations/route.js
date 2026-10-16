import { authenticateRequest } from "@/directory/auth/auth.js";
import prisma from "@/directory/prisma/prisma.js";
import { purgeExpiredConversations } from "@/lib/chat-retention.js";

/**
 * GET /api/admin/chat/conversations   (ADMIN)
 *
 * Lists persisted "chat with admin" conversations, most recent activity
 * first, with the customer's name/email, last message and unread count,
 * so the admin can reply at any time — even hours later.
 */
export async function GET(request) {
    try {
        await purgeExpiredConversations();
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }
        const conversations = await prisma.chatConversation.findMany({
            orderBy: { updatedAt: "desc" },
            take: 100,
            include: {
                user: { select: { name: true, email: true } },
                messages: { orderBy: { createdAt: "asc" } },
            },
        });
        const data = conversations.map((c) => {
            const last = c.messages[c.messages.length - 1] || null;
            return {
                id: c.id,
                userName: c.user?.name || c.user?.email || "Customer",
                userEmail: c.user?.email || "",
                status: c.status,
                createdAt: c.createdAt,
                lastActivity: c.updatedAt,
                unread: c.messages.filter(
                    (m) => m.sender === "visitor" && !m.readByAdmin
                ).length,
                lastMessage: last
                    ? { sender: last.sender, body: last.body, createdAt: last.createdAt }
                    : null,
                messageCount: c.messages.length,
            };
        });
        return Response.json({ success: true, data });
    } catch (error) {
        console.error("GET /api/admin/chat/conversations error:", error);
        return Response.json(
            { success: false, message: "Could not load chats." },
            { status: 500 }
        );
    }
}
