import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_STATUSES = new Set([
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
]);

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, sku: true },
            },
        },
    },
};

function formatOrder(order) {
    return {
        id: order.id,
        user_id: order.userId,

        guest: order.userId
            ? null
            : {
                name: order.guestName,
                phone: order.guestPhone,
            },

        status: order.status.toLowerCase(),
        payment_status: order.paymentStatus.toLowerCase(),

        total_amount: Number(order.totalAmount),
        shipping_fee: Number(order.shippingFee),
        shipping_address: order.shippingAddress,

        items: order.items.map((item) => ({
            id: item.id,
            product_id: item.productId,
            title: item.product?.name ?? null,
            sku: item.product?.sku ?? null,
            unit_price: Number(item.unitPrice),
            quantity: item.quantity,
            subtotal: Number(item.unitPrice) * item.quantity,
        })),

        created_at: order.createdAt,
        updated_at: order.updatedAt,
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);

        const rawStatus = searchParams.get("status")?.trim();

        // Spec: page default 1, per_page default 10, max 50.
        const page = Math.max(Number.parseInt(searchParams.get("page"), 10) || 1, 1);

        let perPage = Number.parseInt(searchParams.get("per_page"), 10);
        if (!Number.isFinite(perPage) || perPage <= 0) perPage = 10;
        perPage = Math.min(perPage, 50);

        if (rawStatus) {
            const normalized = rawStatus.toUpperCase().replace(/-/g, "_");
            if (!VALID_STATUSES.has(normalized)) {
                return Response.json(
                    {
                        success: false,
                        message:
                            "Invalid status. Allowed: pending, confirmed, processing, shipped, delivered, cancelled.",
                        data: null,
                    },
                    { status: 400 }
                );
            }
        }

        const skip = (page - 1) * perPage;

        const where = {
            userId: auth.user.userId,

            ...(rawStatus
                ? {
                      status: rawStatus.toUpperCase().replace(/-/g, "_"),
                  }
                : {}),
        };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
                include: ORDER_INCLUDE,
            }),
            prisma.order.count({ where }),
        ]);

        const totalPages = Math.ceil(total / perPage);
        const hasMore = page < totalPages;

        return Response.json({
            success: true,
            message: "Orders loaded.",
            data: orders.map(formatOrder),
            meta: {
                current_page: page,
                per_page: perPage,
                total,
                total_pages: totalPages,
                has_more: hasMore,
            },
        });
    } catch (error) {
        console.error("Get my orders API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load orders.",
            },
            { status: 500 }
        );
    }
}