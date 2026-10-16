import { authenticateRequest } from "@/directory/auth/auth.js";
import prisma from "@/directory/prisma/prisma.js";
import { purgeExpiredConversations } from "@/lib/chat-retention.js";

/**
 * "Chat with admin" — now PERSISTED in the database (owner request), so a
 * customer can leave and later find the admin's reply waiting in their
 * chat box. (AI chats are still stateless and never logged.)
 *
 *   POST /api/chat/admin-chat   open (or create) the customer's current
 *                               open conversation; returns the thread and
 *                               marks admin messages as read by the user.
 *   GET  /api/chat/admin-chat   lightweight summary for the widget's
 *                               unread badge: { conversationId, unread }.
 */

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

async function openConversationWithThread(userId) {
    const conversation = await prisma.chatConversation.findFirst({
        where: { userId, status: "open" },
        orderBy: { createdAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (conversation) return conversation;
    const created = await prisma.chatConversation.create({
        data: { userId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return created;
}

export async function POST(request) {
    try {
        await purgeExpiredConversations();
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json(
                { success: false, message: "Please sign in to chat." },
                { status: 401 }
            );
        }
        const conversation = await openConversationWithThread(auth.user.userId);
        await prisma.chatMessage.updateMany({
            where: { conversationId: conversation.id, sender: "admin", readByUser: false },
            data: { readByUser: true },
        });
        return Response.json(
            { success: true, data: threadData(conversation) },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/chat/admin-chat error:", error);
        return Response.json(
            { success: false, message: "Could not start the chat." },
            { status: 500 }
        );
    }
}

export async function GET(request) {
    try {
        await purgeExpiredConversations();
        const auth = await authenticateRequest(request);
        if (!auth.authenticated) {
            return Response.json(
                { success: false, message: "Please sign in to chat." },
                { status: 401 }
            );
        }
        const conversation = await prisma.chatConversation.findFirst({
            where: { userId: auth.user.userId, status: "open" },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true },
        });
        let unread = 0;
        if (conversation) {
            unread = await prisma.chatMessage.count({
                where: {
                    conversationId: conversation.id,
                    sender: "admin",
                    readByUser: false,
                },
            });
        }
        return Response.json({
            success: true,
            data: {
                conversationId: conversation ? conversation.id : null,
                status: conversation ? conversation.status : null,
                unread,
            },
        });
    } catch (error) {
        console.error("GET /api/chat/admin-chat error:", error);
        return Response.json(
            { success: false, message: "Could not load chat summary." },
            { status: 500 }
        );
    }
}
