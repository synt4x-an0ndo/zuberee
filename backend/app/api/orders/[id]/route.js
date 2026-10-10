import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
];

const VALID_PAYMENT_STATUSES = [
    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED",
];

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

export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return Response.json(
                { success: false, message: "Invalid order ID." },
                { status: 400 }
            );
        }

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!existingOrder) {
            return Response.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { status, paymentStatus, payment_status } = body;

        const updateData = {};

        if (status !== undefined) {
            const newStatus = String(status)
                .toUpperCase()
                .replace("-", "_");

            if (!VALID_STATUSES.includes(newStatus)) {
                return Response.json(
                    { success: false, message: "Invalid order status." },
                    { status: 400 }
                );
            }

            updateData.status = newStatus;
        }

        const rawPaymentStatus =
            paymentStatus ?? payment_status;

        if (rawPaymentStatus !== undefined) {
            const newPaymentStatus = String(rawPaymentStatus)
                .toUpperCase()
                .replace("-", "_");

            if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
                return Response.json(
                    {
                        success: false,
                        message: "Invalid payment status.",
                    },
                    { status: 400 }
                );
            }

            updateData.paymentStatus = newPaymentStatus;
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                {
                    success: false,
                    message: "No valid fields to update.",
                },
                { status: 400 }
            );
        }

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: updateData,
            include: ORDER_INCLUDE,
        });

        return Response.json({
            success: true,
            message: "Order updated.",
            data: formatOrder(updatedOrder),
        });
    } catch (error) {
        console.error("Update order API error:", error);

        return Response.json(
            { success: false, message: "Failed to update order." },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const orderId = Number(id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return Response.json(
                { success: false, message: "Invalid order ID." },
                { status: 400 }
            );
        }

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!existingOrder) {
            return Response.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        if (existingOrder.status === "DELIVERED") {
            return Response.json(
                {
                    success: false,
                    message: "Delivered orders cannot be deleted.",
                },
                { status: 409 }
            );
        }

        await prisma.order.delete({ where: { id: orderId } });

        return Response.json({
            success: true,
            message: "Order deleted.",
        });
    } catch (error) {
        console.error("Delete order API error:", error);

        return Response.json(
            { success: false, message: "Failed to delete order." },
            { status: 500 }
        );
    }
}