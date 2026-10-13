import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

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

        const status = searchParams.get("status")?.trim();

        const pageParam = searchParams.get("page");
        const perPageParam = searchParams.get("per_page");

        const page =
            pageParam && Number(pageParam) > 0 ? Number(pageParam) : 1;

        const perPage =
            perPageParam &&
            Number(perPageParam) > 0 &&
            Number(perPageParam) <= 50
                ? Number(perPageParam)
                : 10;

        const skip = (page - 1) * perPage;

        const where = {
            userId: auth.user.userId,

            ...(status
                ? {
                    status: status.toUpperCase().replace("-", "_"),
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