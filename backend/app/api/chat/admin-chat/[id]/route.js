import { authenticateRequest } from "@/directory/auth/auth.js";
import prisma from "@/directory/prisma/prisma.js";
import { purgeExpiredConversations } from "@/lib/chat-retention.js";

/**
 * One persisted admin-chat conversation, from the customer's side.
 * The customer must be signed in and own the conversation.
 *
 *   GET    /api/chat/admin-chat/:id   poll messages (marks admin msgs read)
 *   POST   /api/chat/admin-chat/:id   send  { body }
 *   DELETE /api/chat/admin-chat/:id   end the chat (kept in history)
 */

async function ownedConversation(request, conversationId) {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
        return {
            error: Response.json(
                { success: false, message: "Please sign in to chat." },
                { status: 401 }
            ),
        };
    }
    const id = Number(conversationId);
    const conversation = Number.isInteger(id)
        ? await prisma.chatConversation.findFirst({
              where: { id, userId: auth.user.userId },
              include: { messages: { orderBy: { createdAt: "asc" } } },
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
    return { auth, conversation };
}

function threadData(conversation) {
    return {
        conversationId: conversation.id,
        status: conversation.status,
        messages: (conversation.messages || []).map((m) => ({
            id: m.id,
            sender: m.sender,
            body: m.body,
            createdAt: m.createdAt,
        })),
    };
}

export async function GET(request, { params }) {
    try {
        await purgeExpiredConversations();
        const { id } = await params;
        const { conversation, error } = await ownedConversation(request, id);
        if (error) return error;
        await prisma.chatMessage.updateMany({
            where: { conversationId: conversation.id, sender: "admin", readByUser: false },
            data: { readByUser: true },
        });
        return Response.json({ success: true, data: threadData(conversation) });
    } catch (error) {
        console.error("GET /api/chat/admin-chat/:id error:", error);
        return Response.json(
            { success: false, message: "Could not load chat messages." },
            { status: 500 }
        );
    }
}

export async function POST(request, { params }) {
    try {
        await purgeExpiredConversations();
        const { id } = await params;
        const { conversation, error } = await ownedConversation(request, id);
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
        if (conversation.status !== "open") {
            return Response.json(
                { success: false, message: "This chat has ended." },
                { status: 410 }
            );
        }

        const message = await prisma.chatMessage.create({
            data: {
                conversationId: conversation.id,
                sender: "visitor",
                body: text,
                readByUser: true,
            },
        });
        await prisma.chatConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
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
                    status: conversation.status,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/chat/admin-chat/:id error:", error);
        return Response.json(
            { success: false, message: "Could not send the message." },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        await purgeExpiredConversations();
        const { id } = await params;
        const { conversation, error } = await ownedConversation(request, id);
        if (error) return error;
        await prisma.chatConversation.update({
            where: { id: conversation.id },
            data: { status: "ended" },
        });
        return Response.json({
            success: true,
            message: "Chat ended. The conversation stays saved in your account history.",
        });
    } catch (error) {
        console.error("DELETE /api/chat/admin-chat/:id error:", error);
        return Response.json(
            { success: false, message: "Could not end the chat." },
            { status: 500 }
        );
    }
}
