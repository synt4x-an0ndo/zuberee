import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatPlan(s) {
    const hasSubscription =
        !!s.planId && s.status === "active";

    const now = new Date();
    let daysRemaining = 0;

    if (s.expiresAt) {
        const diff = s.expiresAt.getTime() - now.getTime();
        daysRemaining = Math.max(
            0,
            Math.ceil(diff / (1000 * 60 * 60 * 24))
        );
    }

    const remainingFreeCalls = Math.max(
        0,
        (s.callLimit ?? 0) - (s.apiCalls ?? 0)
    );

    const remainingPaidCalls = Math.max(
        0,
        (s.paidLimit ?? 0) - (s.paidCalls ?? 0)
    );

    return {
        plan: {
            has_subscription: hasSubscription,
            plan_id: s.planId,
            plan_name: s.planName,
            plan_type: s.planType,
            is_free: s.isFree,
            status: s.status,
            next_due_date: s.nextDueDate
                ? s.nextDueDate.toISOString().slice(0, 10)
                : null,
            expires_at: s.expiresAt
                ? s.expiresAt
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ")
                : null,
            days_remaining: daysRemaining,
            frequency: s.frequency,
            price:
                s.price === null ? null : Number(s.price),
            api_calls: s.apiCalls ?? 0,
            paid_calls: s.paidCalls ?? 0,
            call_limit: s.callLimit ?? 0,
            paid_limit: s.paidLimit ?? 0,
            remaining_free_calls: remainingFreeCalls,
            remaining_paid_calls: remainingPaidCalls,
        },
        meta: {
            cached: false,
            checked_at: new Date().toISOString().slice(0, 19) + "+00:00",
        },
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        let settings = await prisma.fraudCheckerSettings.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!settings) {
            settings = await prisma.fraudCheckerSettings.create({
                data: {
                    isActive: true,
                    cacheMinutes: 60,
                    providerUrl: "https://api.bdcourier.com/courier-check",
                    isFree: true,
                    status: "inactive",
                },
            });
        }

        return Response.json({
            status: "success",
            data: formatPlan(settings),
        });
    } catch (error) {
        console.error("Fraud checker plan API error:", error);

        return Response.json(
            { status: "failed", message: "Failed to load plan." },
            { status: 500 }
        );
    }
}