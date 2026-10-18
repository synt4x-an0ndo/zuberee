import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, sku: true, images: { orderBy: { isPrimary: "desc" }, take: 1, select: { imageUrl: true } } },
            },
        },
    },
    user: { select: { id: true, name: true, phone: true, email: true } },
};

function formatOrderItem(item) {
    const firstImage = item.product?.images?.[0]?.imageUrl ?? null;
    return {
        id: item.id,
        order_id: item.orderId,
        product_id: item.productId,
        product_variant_id: item.variantId ?? null,
        title: item.product?.name ?? null,
        sku: item.product?.sku ?? null,
        unitPrice: Number(item.unitPrice),
        qty: item.quantity,
        totalPrice: Number(item.unitPrice) * item.quantity,
        colorImage: firstImage,
        color_name: "",
        size: null,
        variant: null,
        created_at: item.createdAt,
    };
}

function formatOrder(order) {
    const subtotal = Number(order.totalAmount) - Number(order.shippingFee);
    return {
        id: order.id,
        order_number: `ORD-${String(order.id).padStart(5, "0")}`,
        user_id: order.userId,
        name: order.user ? order.user.name : order.guestName,
        phone: order.user ? order.user.phone : order.guestPhone,
        address: order.shippingAddress,
        district: order.district,
        shipping_cost: Number(order.shippingFee),
        subtotal,
        total: Number(order.totalAmount),
        advance_payment: Number(order.advancePayment),
        payment_method: order.paymentMethod,
        status: order.status.toLowerCase(),
        payment_status: order.paymentStatus.toLowerCase(),
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        customer_type: order.userId ? "Repeat Customer" : "New",
        order_items: order.items.map(formatOrderItem),
    };
}

export async function GET(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });
        const { id } = await params;
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ success: false, message: "Invalid order ID." }, { status: 400 });

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
        if (!order) return Response.json({ success: false, message: "Order not found." }, { status: 404 });
        return Response.json({ success: true, message: "Order loaded.", data: formatOrder(order) });
    } catch (error) {
        console.error("Admin single order API error:", error);
        return Response.json({ success: false, message: "Failed to load order." }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });

        const { id } = await params;
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ success: false, message: "Invalid order ID." }, { status: 400 });

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }, // Stock restore/update er jonno items lagbe
        });
        if (!existingOrder) return Response.json({ success: false, message: "Order not found." }, { status: 404 });

        const body = await request.json();
        const { status, paymentStatus, payment_status } = body;
        const updateData = {};
        let finalNewStatus = null;

        if (status !== undefined) {
            const newStatus = String(status).toUpperCase().replace("-", "_");
            if (!VALID_STATUSES.includes(newStatus)) return Response.json({ success: false, message: "Invalid order status." }, { status: 400 });
            updateData.status = newStatus;
            finalNewStatus = newStatus;
        }

        const rawPaymentStatus = paymentStatus ?? payment_status;
        if (rawPaymentStatus !== undefined) {
            const newPaymentStatus = String(rawPaymentStatus).toUpperCase().replace("-", "_");
            if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) return Response.json({ success: false, message: "Invalid payment status." }, { status: 400 });
            updateData.paymentStatus = newPaymentStatus;
        }

        if (Object.keys(updateData).length === 0) return Response.json({ success: false, message: "No valid fields to update." }, { status: 400 });

        const updatedOrder = await prisma.$transaction(async (tx) => {
            const order = await tx.order.update({
                where: { id: orderId },
                data: updateData,
                include: ORDER_INCLUDE,
            });

            // Jodi order CANCEL hoy, tahole stock abar ferot asbe (Release)
            if (finalNewStatus === "CANCELLED" && existingOrder.status !== "CANCELLED") {
                for (const item of existingOrder.items) {
                    if (item.variantId) {
                        const updatedVar = await tx.productVariant.update({
                            where: { id: item.variantId },
                            data: { stock: { increment: item.quantity } },
                        });

                        await tx.stockMovement.create({
                            data: {
                                productVariantId: item.variantId,
                                type: "release",
                                quantity: item.quantity,
                                stockAfter: updatedVar.stock,
                                reservedAfter: updatedVar.held,
                                orderId: orderId,
                                note: "Order cancelled, stock returned",
                                userId: auth.user.userId,
                            },
                        });
                    }
                }
            }

            return order;
        });

        return Response.json({ success: true, message: "Order updated.", data: formatOrder(updatedOrder) });
    } catch (error) {
        console.error("Admin update order API error:", error);
        return Response.json({ success: false, message: "Failed to update order." }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") return Response.json({ success: false, message: "Admin access required." }, { status: 403 });

        const { id } = await params;
        const orderId = Number(id);
        if (!Number.isInteger(orderId) || orderId <= 0) return Response.json({ success: false, message: "Invalid order ID." }, { status: 400 });

        const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (!existingOrder) return Response.json({ success: false, message: "Order not found." }, { status: 404 });
        if (existingOrder.status === "DELIVERED") return Response.json({ success: false, message: "Delivered orders cannot be deleted." }, { status: 409 });

        await prisma.order.delete({ where: { id: orderId } });
        return Response.json({ success: true, message: "Order deleted." });
    } catch (error) {
        console.error("Admin delete order API error:", error);
        return Response.json({ success: false, message: "Failed to delete order." }, { status: 500 });
    }
}