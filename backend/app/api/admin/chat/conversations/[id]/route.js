import { authenticateRequest } from "@/directory/auth/auth.js";
import prisma from "@/directory/prisma/prisma.js";
import { purgeExpiredConversations } from "@/lib/chat-retention.js";

/**
 * One persisted chat, from the admin's side.
 *
 *   GET    /api/admin/chat/conversations/:id   messages (marks admin-read)
 *   POST   /api/admin/chat/conversations/:id   reply  { body }
 *          (replying to an ended chat reopens it for the customer)
 *   DELETE /api/admin/chat/conversations/:id   end the chat (history kept)
 */

async function adminConversation(request, conversationId) {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated || auth.user.role !== "ADMIN") {
        return {
            error: Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            ),
        };
    }
    const id = Number(conversationId);
    const conversation = Number.isInteger(id)
        ? await prisma.chatConversation.findUnique({
              where: { id },
              include: {
                  user: { select: { name: true, email: true } },
                  messages: { orderBy: { createdAt: "asc" } },
              },
          })
        : null;
    if (!conversation) {
        return {
            error: Response.json(
                { success: false, message: "Chat not found." },
                { status: 404 }
            ),
        };
    }
    return { conversation };
}

function flatMessages(conversation) {
    return (conversation.messages || []).map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt,
    }));
}

export async function GET(request, { params }) {
    try {
        await purgeExpiredConversations();
        const { id } = await params;
        const { conversation, error } = await adminConversation(request, id);
        if (error) return error;
        await prisma.chatMessage.updateMany({
            where: { conversationId: conversation.id, sender: "visitor", readByAdmin: false },
            data: { readByAdmin: true },
        });
        return Response.json({
            success: true,
            data: {
                id: conversation.id,
                userName: conversation.user?.name || conversation.user?.email || "Customer",
                userEmail: conversation.user?.email || "",
                status: conversation.status,
                createdAt: conversation.createdAt,
                messages: flatMessages(conversation),
            },
        });
    } catch (error) {
        console.error("GET /api/admin/chat/conversations/:id error:", error);
        return Response.json(
            { success: false, message: "Could not load the chat." },
            { status: 500 }
        );
    }
}

export async function POST(request, { params }) {
    try {
        await purgeExpiredConversations();
        const { id } = await params;
        const { conversation, error } = await adminConversation(request, id);
        if (error) return error;

        let body = {};
        try {
            body = await request.json();
        } catch {
            /* validated below */
        }
        const text = typeof body.body === "string" ? body.body.trim() : "";
        if (!text) {
            return Response.json(
                { success: false, message: "Message cannot be empty." },
                { status: 400 }
            );
        }
        if (text.length > 2000) {
            return Response.json(
                { success: false, message: "Message is too long (max 2000 characters)." },
                { status: 400 }
            );
        }

        const message = await prisma.chatMessage.create({
            data: {
                conversationId: conversation.id,
                sender: "admin",
                body: text,
                readByAdmin: true,
            },
        });
        // Replying reopens an ended chat so the customer sees it as active,
        // with this reply waiting unread in their chat box.
        await prisma.chatConversation.update({
            where: { id: conversation.id },
            data: { status: "open", updatedAt: new Date() },
        });
        return Response.json(
            {
                success: true,
                data: {
                    message: {
                        id: message.id,
                        sender: message.sender,
                        body: message.body,
                        createdAt: message.createdAt,
                    },
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/admin/chat/conversations/:id error:", error);
        return Response.json(
            { success: false, message: "Could not send the reply." },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        await purgeExpiredConversations();
        const { id } = await params;
        const { conversation, error } = await adminConversation(request, id);
        if (error) return error;
        await prisma.chatConversation.update({
            where: { id: conversation.id },
            data: { status: "ended" },
        });
        return Response.json({
            success: true,
            message: "Chat ended. The conversation stays in the chat history.",
        });
    } catch (error) {
        console.error("DELETE /api/admin/chat/conversations/:id error:", error);
        return Response.json(
            { success: false, message: "Could not end the chat." },
            { status: 500 }
        );
    }
}
