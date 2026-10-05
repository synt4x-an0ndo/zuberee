import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function serializeOrder(order) {
    return {
        ...order,
        totalAmount: Number(order.totalAmount),
        shippingFee: Number(order.shippingFee),
        items: order.items.map((item) => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            product: item.product ? {
                id: item.product.id,
                name: item.product.name,
                images: item.product.images,
            } : null,
        })),
    };
}

export async function GET(request) {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
        return Response.json({ success: false, message: auth.message, data: null }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
        where: { userId: Number(auth.user.userId) },
        orderBy: { createdAt: "desc" },
        include: {
            items: {
                include: {
                    product: { select: { id: true, name: true, images: { where: { isPrimary: true }, select: { imageUrl: true } } } },
                },
            },
        },
    });

    return Response.json({ success: true, message: "Orders loaded.", data: orders.map(serializeOrder) });
}