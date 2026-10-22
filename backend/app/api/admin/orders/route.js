import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { requireValidOrderContact } from "@/lib/contactValidation.js";
import { allocateOrderEntries } from "@/lib/preorder.js";
import {
    adjustProductStock,
    adjustVariantStock,
    inventoryError,
    isTransactionConflict,
    lockProductFamilies,
    syncVariantProductStock,
} from "@/lib/inventory.js";

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
            variant: {
                select: { id: true, name: true, value: true },
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
        is_preorder: Boolean(item.isPreorder || item.preorderQuantity > 0),
        preorder_quantity: item.preorderQuantity || 0,
        inventory_state: item.preorderQuantity > 0 ? "preorder" : "committed",
        colorImage: firstImage,
        selected_size: item.size || item.variant?.value || null,
        totalPrice: Number(item.unitPrice) * item.quantity,
        created_at: item.createdAt,
        updated_at: item.createdAt,
        color_name: "",
        size: item.size || item.variant?.value || null,
        variant: item.variant ? item.variant.value || item.variant.name || null : null,
    };
}

function formatOrder(order) {
    const subtotal =
        Number(order.totalAmount) - Number(order.shippingFee);

    return {
        id: order.id,
        order_number: `ORD-${String(order.id).padStart(5, "0")}`,
        user_id: order.userId,
        name: order.contactName || (order.user
            ? order.user.name
            : order.guestName ?? "Guest"),
        phone: order.contactPhone || (order.user
            ? order.user.phone
            : order.guestPhone ?? null),
        email: order.contactEmail || order.user?.email || null,
        address: order.shippingAddress,
        district: order.district,
        shipping_cost: Number(order.shippingFee),
        subtotal,
        total: Number(order.totalAmount),
        advance_payment: Number(order.advancePayment),
        payment_method: order.paymentMethod,
        delivery_notes: order.deliveryNotes || "",
        status: order.status.toLowerCase(),
        payment_status: order.paymentStatus.toLowerCase(),
        courier_entry: order.courierEntry || "",
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
            const insensitive = { contains: search, mode: "insensitive" };
            where.OR = [
                { user: { name: insensitive } },
                { user: { phone: insensitive } },
                { user: { email: insensitive } },
                { guestName: insensitive },
                { guestPhone: insensitive },
                { contactName: insensitive },
                { contactPhone: insensitive },
                { contactEmail: insensitive },
            ];

            // "Order number" in the UI is the numeric order id, displayed as
            // ORD-00037 (and sometimes typed as #37) — accept all three forms.
            const orderNumber = search.replace(/^#/, "").replace(/^ord-?/i, "").trim();
            if (/^\d+$/.test(orderNumber)) {
                where.OR.push({ id: Number(orderNumber) });
            }
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
            return Response.json({ success: false, message: "Admin access required." }, { status: 403 });
        }

        const body = await request.json();
        const {
            userId, guestName, guestPhone, guestEmail, guestAddress,
            name, phone, email, contactName, contactPhone, contactEmail,
            district, shippingAddress, shippingFee = 0, advancePayment = 0,
            paymentMethod = "cash", items: bodyItems,
        } = body;
        if (!Array.isArray(bodyItems) || bodyItems.length === 0) {
            return Response.json({ success: false, message: "Items are required." }, { status: 400 });
        }

        let finalName = null;
        let finalPhone = null;
        let finalEmail = null;
        let finalUserId = null;
        let finalShippingAddress = shippingAddress ? String(shippingAddress).trim() : null;
        if (userId) {
            const user = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { id: true, name: true, phone: true, email: true } });
            if (!user) return Response.json({ success: false, message: "User not found." }, { status: 404 });
            finalUserId = user.id;
            finalName = contactName ?? name ?? guestName ?? user.name;
            finalPhone = contactPhone ?? phone ?? guestPhone ?? user.phone;
            finalEmail = contactEmail ?? email ?? guestEmail ?? user.email;
        } else {
            finalName = contactName ?? name ?? guestName;
            finalPhone = contactPhone ?? phone ?? guestPhone;
            finalEmail = contactEmail ?? email ?? guestEmail;
            if (guestAddress) finalShippingAddress = String(guestAddress).trim();
        }
        finalName = finalName ? String(finalName).trim() : "";
        if (!finalName) return Response.json({ success: false, message: "Customer name is required." }, { status: 400 });
        try {
            const contact = requireValidOrderContact({ phone: finalPhone, email: finalEmail });
            finalPhone = contact.phone;
            finalEmail = contact.email;
        } catch (validationError) {
            return Response.json({ success: false, message: validationError.message }, { status: validationError.status || 400 });
        }
        if (!finalShippingAddress) return Response.json({ success: false, message: "Shipping address is required." }, { status: 400 });

        const finalShippingFee = Number(shippingFee) || 0;
        const finalAdvancePayment = Number(advancePayment) || 0;
        const order = await prisma.$transaction(async (tx) => {
            const productIds = [...new Set(bodyItems.map((item) => Number(item.productId ?? item.product_id)).filter((id) => Number.isInteger(id) && id > 0))];
            if (!productIds.length) throw inventoryError("Invalid product in order.", 400);
            await lockProductFamilies(tx, productIds);
            const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: { variants: true, inventory: true } });
            const productMap = new Map(products.map((product) => [product.id, product]));
            const entries = [];
            let totalAmount = 0;

            for (const raw of bodyItems) {
                const productId = Number(raw.productId ?? raw.product_id);
                const variantId = raw.variantId ?? raw.variant_id ?? null;
                const quantity = Number(raw.quantity ?? 1);
                if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 1) {
                    throw inventoryError("Invalid item quantity or product.", 400);
                }
                const product = productMap.get(productId);
                if (!product || !product.isActive) throw inventoryError(`Product ${productId} not available.`, 404);
                let variant = null;
                let unitPrice = product.discount !== null ? Number(product.discount) : Number(product.price);
                if (variantId !== null && variantId !== "") {
                    variant = product.variants.find((row) => row.id === Number(variantId)) || null;
                    if (!variant) throw inventoryError(`Variant ${variantId} not found.`, 404);
                    if (!variant.isActive) throw inventoryError(`Variant ${variant.value} is not available.`, 400);
                    if (variant.price !== null) unitPrice = Number(variant.price);
                } else if (product.variants.length > 0) {
                    throw inventoryError(`Please select a variant for ${product.name}.`, 400);
                }
                entries.push({ product, variant, productId, variantId: variant?.id ?? null, size: variant?.value ? String(variant.value) : raw.size ?? raw.selected_size ?? null, quantity, unitPrice });
                totalAmount += unitPrice * quantity;
            }
            allocateOrderEntries(entries);

            const createdOrder = await tx.order.create({
                data: {
                    userId: finalUserId,
                    guestName: finalUserId ? null : finalName,
                    guestPhone: finalUserId ? null : finalPhone,
                    contactName: finalName,
                    contactPhone: finalPhone,
                    contactEmail: finalEmail,
                    status: "PENDING",
                    paymentStatus: "PENDING",
                    totalAmount: totalAmount + finalShippingFee,
                    shippingFee: finalShippingFee,
                    shippingAddress: finalShippingAddress,
                    district: district ? String(district).trim() : null,
                    advancePayment: finalAdvancePayment,
                    paymentMethod: String(paymentMethod),
                    items: { create: entries.map((item) => ({ productId: item.productId, variantId: item.variantId, size: item.size ? String(item.size) : null, quantity: item.quantity, unitPrice: item.unitPrice, isPreorder: item.isPreorder, preorderQuantity: item.preorderQuantity, stockMode: item.usesVariantStock ? "VARIANT" : "PRODUCT" })) },
                },
                include: ORDER_INCLUDE,
            });

            const variantProductIds = new Set();
            for (const item of entries) {
                if (item.usesVariantStock && item.stockQuantity > 0) {
                    await adjustVariantStock(tx, { variantId: item.variantId, delta: -item.stockQuantity, type: "sale", note: "Admin order placed", userId: auth.user.userId, orderId: createdOrder.id });
                    variantProductIds.add(item.productId);
                }
                if (item.usesVariantStock && item.preorderQuantity > 0) {
                    await tx.productVariant.update({ where: { id: item.variantId }, data: { preorderCount: { increment: item.preorderQuantity } } });
                }
                if (!item.usesVariantStock && item.stockQuantity > 0) {
                    await adjustProductStock(tx, { productId: item.productId, delta: -item.stockQuantity, type: "sale", note: "Admin order placed", userId: auth.user.userId, orderId: createdOrder.id });
                }
            }
            await syncVariantProductStock(tx, [...variantProductIds]);
            return createdOrder;
        }, { isolationLevel: "Serializable" });

        return Response.json({ success: true, message: "Order created successfully.", data: formatOrder(order) }, { status: 201 });
    } catch (error) {
        if (Number.isInteger(error?.status)) return Response.json({ success: false, message: error.message }, { status: error.status });
        if (isTransactionConflict(error)) return Response.json({ success: false, message: "Stock changed while the order was being created. Please try again." }, { status: 409 });
        console.error("Admin create order API error:", error);
        return Response.json({ success: false, message: "Failed to create order." }, { status: 500 });
    }
}
