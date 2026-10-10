import prisma from "../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { cookies } from "next/headers";
import { CART_COOKIE_NAME } from "@/lib/cart.js";

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

export async function POST(request) {
    try {
        const body = await request.json();

        const {
            guestName,
            guestPhone,
            guestAddress,
            shippingAddressId,
            shippingAddress,
            shippingFee = 0,
            items: bodyItems,
        } = body;

        const auth = await authenticateRequest(request);
        const isGuest = !auth.authenticated;

        if (isGuest) {
            if (!guestName || !String(guestName).trim()) {
                return Response.json(
                    { success: false, message: "Guest name is required." },
                    { status: 400 }
                );
            }

            if (!guestPhone || !String(guestPhone).trim()) {
                return Response.json(
                    { success: false, message: "Guest phone is required." },
                    { status: 400 }
                );
            }

            if (!guestAddress || !String(guestAddress).trim()) {
                return Response.json(
                    { success: false, message: "Guest address is required." },
                    { status: 400 }
                );
            }
        }

        let finalShippingAddress = shippingAddress
            ? String(shippingAddress).trim()
            : null;

        if (!isGuest && shippingAddressId) {
            const addressRecord = await prisma.address.findFirst({
                where: {
                    id: Number(shippingAddressId),
                    userId: auth.user.userId,
                },
            });

            if (!addressRecord) {
                return Response.json(
                    { success: false, message: "Shipping address not found." },
                    { status: 404 }
                );
            }

            finalShippingAddress = [
                addressRecord.fullName,
                addressRecord.phone,
                addressRecord.addressLine,
                addressRecord.city,
                addressRecord.postalCode,
                addressRecord.country,
            ]
                .filter(Boolean)
                .join(", ");
        }

        if (isGuest) {
            finalShippingAddress = String(guestAddress).trim();
        }

        if (!finalShippingAddress) {
            return Response.json(
                { success: false, message: "Shipping address is required." },
                { status: 400 }
            );
        }

        let rawItems = Array.isArray(bodyItems) ? bodyItems : [];
        let cartId = null;

        if (rawItems.length === 0) {
            const cookieStore = await cookies();
            const sessionId = cookieStore.get(CART_COOKIE_NAME)?.value;

            let cart = null;

            if (!isGuest) {
                cart = await prisma.cart.findUnique({
                    where: { userId: auth.user.userId },
                    include: { items: true },
                });
            } else if (sessionId) {
                cart = await prisma.cart.findUnique({
                    where: { sessionId },
                    include: { items: true },
                });
            }

            if (!cart || cart.items.length === 0) {
                return Response.json(
                    { success: false, message: "Cart is empty." },
                    { status: 400 }
                );
            }

            cartId = cart.id;

            rawItems = cart.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
            }));
        }

        if (rawItems.length === 0) {
            return Response.json(
                { success: false, message: "No items to order." },
                { status: 400 }
            );
        }

        const productIds = [
            ...new Set(
                rawItems.map((i) => Number(i.productId ?? i.product_id))
            ),
        ];

        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { variants: true },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        const orderItemsData = [];
        let totalAmount = 0;

        for (const raw of rawItems) {
            const productId = Number(raw.productId ?? raw.product_id);
            const variantId = raw.variantId ?? raw.variant_id ?? null;
            const quantity = Number(raw.quantity ?? 1);

            if (!Number.isInteger(quantity) || quantity < 1) {
                return Response.json(
                    { success: false, message: "Invalid item quantity." },
                    { status: 400 }
                );
            }

            const product = productMap.get(productId);

            if (!product || !product.isActive) {
                return Response.json(
                    {
                        success: false,
                        message: `Product ${productId} not available.`,
                    },
                    { status: 404 }
                );
            }

            let unitPrice = Number(product.price);

            if (product.discount !== null) {
                unitPrice = Number(product.discount);
            }

            let variant = null;

            if (variantId !== null) {
                variant = product.variants.find(
                    (v) => v.id === Number(variantId)
                );

                if (!variant) {
                    return Response.json(
                        {
                            success: false,
                            message: `Variant ${variantId} not found.`,
                        },
                        { status: 404 }
                    );
                }

                if (variant.price !== null) {
                    unitPrice = Number(variant.price);
                }

                if (variant.stock < quantity) {
                    return Response.json(
                        {
                            success: false,
                            message: `Not enough stock for variant ${variant.value}.`,
                        },
                        { status: 400 }
                    );
                }
            } else if (product.stock < quantity) {
                return Response.json(
                    {
                        success: false,
                        message: `Not enough stock for ${product.name}.`,
                    },
                    { status: 400 }
                );
            }

            orderItemsData.push({
                productId,
                variantId: variant ? variant.id : null,
                quantity,
                unitPrice,
            });

            totalAmount += unitPrice * quantity;
        }

        const finalShippingFee = Number(shippingFee) || 0;

        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.order.create({
                data: {
                    userId: isGuest ? null : auth.user.userId,
                    guestName: isGuest ? String(guestName).trim() : null,
                    guestPhone: isGuest ? String(guestPhone).trim() : null,

                    status: "PENDING",
                    paymentStatus: "PENDING",

                    totalAmount: totalAmount + finalShippingFee,
                    shippingFee: finalShippingFee,
                    shippingAddress: finalShippingAddress,

                    items: {
                        create: orderItemsData.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                        })),
                    },
                },
                include: ORDER_INCLUDE,
            });

            for (const item of orderItemsData) {
                if (item.variantId !== null) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: { stock: { decrement: item.quantity } },
                    });
                }

                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            if (cartId) {
                await tx.cartItem.deleteMany({
                    where: { cartId },
                });
            }

            return createdOrder;
        });

        return Response.json(
            {
                success: true,
                message: "Order placed successfully. Cash on delivery.",
                data: formatOrder(order),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create order API error:", error);

        return Response.json(
            { success: false, message: "Failed to place order." },
            { status: 500 }
        );
    }
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
        const status = searchParams.get("status")?.trim();

        const orders = await prisma.order.findMany({
            where: status
                ? {
                    status: status
                        .toUpperCase()
                        .replace("-", "_"),
                }
                : {},
            orderBy: { createdAt: "desc" },
            include: ORDER_INCLUDE,
        });

        return Response.json({
            success: true,
            message: "Orders loaded.",
            data: orders.map(formatOrder),
        });
    } catch (error) {
        console.error("Get orders API error:", error);

        return Response.json(
            { success: false, message: "Failed to load orders." },
            { status: 500 }
        );
    }
}