import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_STATUSES = [
    "pending",
    "cancelled",
    "completed",
    "converted",
];

function formatCheckout(c) {
    return {
        id: c.id,
        session_id: c.sessionId,
        user_id: c.userId,
        cart_items: c.cartItems,
        name: c.name,
        phone: c.phone,
        address: c.address,
        is_recovered: c.isRecovered,
        status: c.status,
        converted_order_id: c.convertedOrderId,
        converted_at: c.convertedAt,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
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

        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status")?.trim();
        const recovered = searchParams.get("recovered")?.trim();

        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(
            100,
            Math.max(1, Number(searchParams.get("per_page") ?? 50))
        );

        const skip = (page - 1) * perPage;

        const where = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { sessionId: { contains: search, mode: "insensitive" } },
            ];
        }

        if (status && VALID_STATUSES.includes(status.toLowerCase())) {
            where.status = status.toLowerCase();
        }

        if (recovered === "true") {
            where.isRecovered = true;
        } else if (recovered === "false") {
            where.isRecovered = false;
        }

        const [checkouts, total] = await Promise.all([
            prisma.abandonedCheckout.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
            }),
            prisma.abandonedCheckout.count({ where }),
        ]);

        const totalPages = Math.ceil(total / perPage);

        return Response.json({
            success: true,
            message: "Abandoned checkouts loaded.",
            data: checkouts.map(formatCheckout),
            meta: {
                current_page: page,
                per_page: perPage,
                total,
                total_pages: totalPages,
                has_more: page < totalPages,
                from: total > 0 ? skip + 1 : 0,
                to: Math.min(skip + perPage, total),
            },
        });
    } catch (error) {
        console.error("Abandoned checkouts API error:", error);

        return Response.json(
            { success: false, message: "Failed to load abandoned checkouts." },
            { status: 500 }
        );
    }
}