import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
];

const ORDER_INCLUDE = {
    items: {
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    images: {
                        orderBy: { isPrimary: "desc" },
                        take: 1,
                        select: { imageUrl: true },
                    },
                },
            },
        },
    },
    user: {
        select: {
            id: true,
            name: true,
            phone: true,
            email: true,
        },
    },
};

function formatOrderItem(item) {
    const firstImage = item.product?.images?.[0]?.imageUrl ?? null;

    return {
        id: item.id,
        order_id: item.orderId,
        product_id: item.productId,
        product_variant_id: item.variantId ?? null,
        product_color_id: null,
        title: item.product?.name ?? null,
        sku: item.product?.sku ?? null,
        unitPrice: Number(item.unitPrice),
        qty: item.quantity,
        is_preorder: false,
        inventory_state: "committed",
        colorImage: firstImage,
        selected_size: null,
        totalPrice: Number(item.unitPrice) * item.quantity,
        created_at: item.createdAt,
        updated_at: item.createdAt,
        color_name: "",
        size: null,
        variant: null,
    };
}

function formatOrder(order) {
    const subtotal =
        Number(order.totalAmount) - Number(order.shippingFee);

    return {
        id: order.id,
        order_number: `ORD-${String(order.id).padStart(5, "0")}`,
        user_id: order.userId,
        name: order.user
            ? order.user.name
            : order.guestName ?? "Guest",
        phone: order.user
            ? order.user.phone
            : order.guestPhone ?? null,
        address: order.shippingAddress,
        district: order.district,
        shipping_cost: Number(order.shippingFee),
        subtotal,
        total: Number(order.totalAmount),
        advance_payment: Number(order.advancePayment),
        payment_method: order.paymentMethod,
        delivery_notes: null,
        status: order.status.toLowerCase(),
        courier_entry: 0,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        customer_type: order.userId ? "Repeat Customer" : "New",
        assigned_badge: null,
        order_items: order.items.map(formatOrderItem),
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                {
                    success: false,
                    message: "Admin access required.",
                },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();
        const status = searchParams.get("status")?.trim();
        const district = searchParams.get("district")?.trim();
        const productId = searchParams.get("product_id")?.trim();
        const minPrice = searchParams.get("min_price");
        const maxPrice = searchParams.get("max_price");
        const fromDate = searchParams.get("from");
        const toDate = searchParams.get("to");

        const page = Math.max(
            1,
            Number(searchParams.get("page") ?? 1)
        );

        const perPage = Math.min(
            100,
            Math.max(1, Number(searchParams.get("per_page") ?? 50))
        );

        const skip = (page - 1) * perPage;

        const where = {};

        if (search) {
            where.OR = [
                {
                    user: {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    user: {
                        phone: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    guestName: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    guestPhone: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        if (status && VALID_STATUSES.includes(status.toLowerCase())) {
            where.status = status.toUpperCase();
        }

        if (district) {
            where.district = {
                equals: district,
                mode: "insensitive",
            };
        }

        if (productId) {
            where.items = {
                some: { productId: Number(productId) },
            };
        }

        if (minPrice || maxPrice) {
            where.totalAmount = {};
            if (minPrice) where.totalAmount.gte = Number(minPrice);
            if (maxPrice) where.totalAmount.lte = Number(maxPrice);
        }

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);
                where.createdAt.gte = from;
            }
            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }

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

        return Response.json({
            success: true,
            message: "Orders loaded.",
            data: orders.map(formatOrder),
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
        console.error("Admin orders list API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load orders.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                {
                    success: false,
                    message: "Admin access required.",
                },
                { status: 403 }
            );
        }

        const body = await request.json();

        const {
            userId,
            guestName,
            guestPhone,
            guestAddress,
            district,
            shippingAddress,
            shippingFee = 0,
            advancePayment = 0,
            paymentMethod = "cash",
            items: bodyItems,
        } = body;

        if (!Array.isArray(bodyItems) || bodyItems.length === 0) {
            return Response.json(
                {
                    success: false,
                    message: "Items are required.",
                },
                { status: 400 }
            );
        }

        let finalName = null;
        let finalPhone = null;
        let finalUserId = null;
        let finalShippingAddress = shippingAddress
            ? String(shippingAddress).trim()
            : null;

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: Number(userId) },
                select: { id: true, name: true, phone: true },
            });

            if (!user) {
                return Response.json(
                    {
                        success: false,
                        message: "User not found.",
                    },
                    { status: 404 }
                );
            }

            finalUserId = user.id;
            finalName = user.name;
            finalPhone = user.phone;
        } else {
            if (!guestName || !String(guestName).trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "Customer name is required.",
                    },
                    { status: 400 }
                );
            }

            if (!guestPhone || !String(guestPhone).trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "Customer phone is required.",
                    },
                    { status: 400 }
                );
            }

            finalName = String(guestName).trim();
            finalPhone = String(guestPhone).trim();

            if (guestAddress) {
                finalShippingAddress = String(guestAddress).trim();
            }
        }

        if (!finalShippingAddress) {
            return Response.json(
                {
                    success: false,
                    message: "Shipping address is required.",
                },
                { status: 400 }
            );
        }

        const productIds = [
            ...new Set(
                bodyItems.map((i) =>
                    Number(i.productId ?? i.product_id)
                )
            ),
        ];

        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { variants: true },
        });

        const productMap = new Map(
            products.map((p) => [p.id, p])
        );

        const orderItemsData = [];
        let totalAmount = 0;

        for (const raw of bodyItems) {
            const productId = Number(
                raw.productId ?? raw.product_id
            );
            const variantId =
                raw.variantId ?? raw.variant_id ?? null;
            const quantity = Number(raw.quantity ?? 1);

            if (!Number.isInteger(quantity) || quantity < 1) {
                return Response.json(
                    {
                        success: false,
                        message: "Invalid item quantity.",
                    },
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
        const finalAdvancePayment = Number(advancePayment) || 0;

        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.order.create({
                data: {
                    userId: finalUserId,
                    guestName: finalUserId ? null : finalName,
                    guestPhone: finalUserId ? null : finalPhone,

                    status: "PENDING",
                    paymentStatus: "PENDING",

                    totalAmount:
                        totalAmount + finalShippingFee,
                    shippingFee: finalShippingFee,
                    shippingAddress: finalShippingAddress,
                    district: district
                        ? String(district).trim()
                        : null,
                    advancePayment: finalAdvancePayment,
                    paymentMethod: String(paymentMethod),

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
                        data: {
                            stock: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }

                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: { decrement: item.quantity },
                    },
                });
            }

            return createdOrder;
        });

        return Response.json(
            {
                success: true,
                message: "Order created successfully.",
                data: formatOrder(order),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Admin create order API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to create order.",
            },
            { status: 500 }
        );
    }
}