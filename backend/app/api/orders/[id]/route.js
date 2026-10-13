import prisma from "../../../../directory/prisma/prisma.js";

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
        district: order.district,
        advance_payment: Number(order.advancePayment),
        payment_method: order.paymentMethod,

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

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return Response.json(
                { success: false, message: "Invalid order ID." },
                { status: 400 }
            );
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: ORDER_INCLUDE,
        });

        if (!order) {
            return Response.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        return Response.json({
            success: true,
            message: "Order loaded.",
            data: formatOrder(order),
        });
    } catch (error) {
        console.error("Get order API error:", error);

        return Response.json(
            { success: false, message: "Failed to load order." },
            { status: 500 }
        );
    }
}