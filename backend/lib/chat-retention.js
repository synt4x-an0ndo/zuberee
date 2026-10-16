import prisma from "@/directory/prisma/prisma.js";

/**
 * Retention rule (owner request): a "chat with admin" conversation is
 * automatically deleted 7 days after its CREATION date, together with
 * all its messages (FK cascade), regardless of later activity.
 *
 * Enforced lazily — every chat API call runs this sweep first — so no
 * cron/scheduler is needed. A process-level throttle keeps the extra
 * DELETE to at most once a minute no matter how often the widget polls.
 * If a customer's open conversation expires mid-use, their next poll
 * simply sees it as ended and they can start a new chat.
 */

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

export async function purgeExpiredConversations() {
    const now = Date.now();
    const last = globalThis.__chatRetentionLastSweep || 0;
    if (now - last < SWEEP_INTERVAL_MS) return;
    globalThis.__chatRetentionLastSweep = now;
    try {
        await prisma.chatConversation.deleteMany({
            where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
        });
    } catch (error) {
        // Never let housekeeping break the chat itself; retry next minute.
        globalThis.__chatRetentionLastSweep = 0;
        console.error("Chat retention sweep failed:", error);
    }
}
