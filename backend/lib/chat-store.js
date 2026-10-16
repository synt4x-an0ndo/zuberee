/**
 * RETIRED — "chat with admin" is persisted in the database as of the
 * chat-persistence update (see app/api/chat/admin-chat and
 * app/api/admin/chat, using the ChatConversation / ChatMessage models).
 * This file remains only so stale imports fail loudly if any reappear.
 */
export function removedChatStore() {
    throw new Error("lib/chat-store.js was retired: admin chat now uses the database.");
}
