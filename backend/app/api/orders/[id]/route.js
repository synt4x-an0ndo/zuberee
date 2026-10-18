import prisma from "@/directory/prisma/prisma.js";

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: { id: true, name: true, sku: true },
            },
            variant: {
                select: { id: true, name: true, value: true },
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
                name: order.contactName || order.guestName,
                phone: order.contactPhone || order.guestPhone,
            },

        status: order.status.toLowerCase(),
        payment_status: order.paymentStatus.toLowerCase(),

        total_amount: Number(order.totalAmount),
        shipping_fee: Number(order.shippingFee),
        shipping_address: order.shippingAddress,
        district: order.district,
        advance_payment: Number(order.advancePayment),
        payment_method: order.paymentMethod,
        courier_entry: order.courierEntry || "",

        items: order.items.map((item) => ({
            id: item.id,
            product_id: item.productId,
            product_variant_id: item.variantId ?? null,
            size: item.size || item.variant?.value || null,
            title: item.product?.name ?? null,
            sku: item.product?.sku ?? null,
            unit_price: Number(item.unitPrice),
            quantity: item.quantity,
            is_preorder: Boolean(item.isPreorder || item.preorderQuantity > 0),
            preorder_quantity: item.preorderQuantity || 0,
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