import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { cookies } from "next/headers";
import { CART_COOKIE_NAME } from "@/lib/cart.js";
import { requireValidOrderContact } from "@/lib/contactValidation.js";
import { allocateOrderEntries } from "@/lib/preorder.js";
import { syncAbandonedCheckout } from "@/lib/abandonedCheckout.js";

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
        guest: order.userId ? null : { name: order.contactName || order.guestName, phone: order.contactPhone || order.guestPhone },
        courier_entry: order.courierEntry || "",
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

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            guestName, guestPhone, guestEmail, guestAddress,
            name, phone, email, contactName, contactPhone, contactEmail,
            district, shippingAddressId, shippingAddress,
            shippingFee = 0, advancePayment = 0, paymentMethod = "cash", items: bodyItems,
        } = body;

        const auth = await authenticateRequest(request);
        const isGuest = !auth.authenticated;

        let finalShippingAddress = shippingAddress ? String(shippingAddress).trim() : null;
        let addressRecord = null;
        let accountProfile = null;

        if (!isGuest) {
            accountProfile = await prisma.user.findUnique({
                where: { id: auth.user.userId },
                select: { name: true, phone: true, email: true },
            });

            if (shippingAddressId) {
                addressRecord = await prisma.address.findFirst({
                    where: { id: Number(shippingAddressId), userId: auth.user.userId },
                });
                if (!addressRecord) return Response.json({ success: false, message: "Shipping address not found." }, { status: 404 });
                finalShippingAddress = [
                    addressRecord.fullName, addressRecord.phone, addressRecord.addressLine,
                    addressRecord.city, addressRecord.postalCode, addressRecord.country,
                ].filter(Boolean).join(", ");
            }
        }

        if (isGuest) {
            if (!guestAddress || !String(guestAddress).trim()) return Response.json({ success: false, message: "Guest address is required." }, { status: 400 });
            finalShippingAddress = String(guestAddress).trim();
        }
        if (!finalShippingAddress) return Response.json({ success: false, message: "Shipping address is required." }, { status: 400 });

        const finalContactName = String(
            contactName ?? name ?? guestName ?? addressRecord?.fullName ?? accountProfile?.name ?? ""
        ).trim();
        if (!finalContactName) return Response.json({ success: false, message: "Customer name is required." }, { status: 400 });

        let finalContact;
        try {
            finalContact = requireValidOrderContact({
                phone: contactPhone ?? phone ?? guestPhone ?? addressRecord?.phone ?? accountProfile?.phone ?? "",
                email: contactEmail ?? email ?? guestEmail ?? accountProfile?.email ?? "",
            });
        } catch (validationError) {
            return Response.json({ success: false, message: validationError.message }, { status: validationError.status || 400 });
        }

        let rawItems = Array.isArray(bodyItems) ? bodyItems : [];
        let cartId = null;

        if (rawItems.length === 0) {
            const cookieStore = await cookies();
            const sessionId = cookieStore.get(CART_COOKIE_NAME)?.value;
            let cart = null;

            if (!isGuest) {
                cart = await prisma.cart.findUnique({ where: { userId: auth.user.userId }, include: { items: true } });
            } else if (sessionId) {
                cart = await prisma.cart.findUnique({ where: { sessionId }, include: { items: true } });
            }

            if (!cart || cart.items.length === 0) return Response.json({ success: false, message: "Cart is empty." }, { status: 400 });

            cartId = cart.id;
            rawItems = cart.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }));
        }

        if (rawItems.length === 0) return Response.json({ success: false, message: "No items to order." }, { status: 400 });

        const productIds = [...new Set(rawItems.map((i) => Number(i.productId ?? i.product_id)))];
        const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { variants: true } });
        const productMap = new Map(products.map((p) => [p.id, p]));

        const orderItemsData = [];
        let totalAmount = 0;

        for (const raw of rawItems) {
            const productId = Number(raw.productId ?? raw.product_id);
            const variantId = raw.variantId ?? raw.variant_id ?? null;
            const quantity = Number(raw.quantity ?? 1);

            if (!Number.isInteger(quantity) || quantity < 1) return Response.json({ success: false, message: "Invalid item quantity." }, { status: 400 });

            const product = productMap.get(productId);
            if (!product || !product.isActive) return Response.json({ success: false, message: `Product ${productId} not available.` }, { status: 404 });

            let unitPrice = Number(product.price);
            if (product.discount !== null) unitPrice = Number(product.discount);

            let variant = null;

            if (variantId !== null) {
                variant = product.variants.find((v) => v.id === Number(variantId));
                if (!variant) return Response.json({ success: false, message: `Variant ${variantId} not found.` }, { status: 404 });
                if (variant.price !== null) unitPrice = Number(variant.price);
            }

            orderItemsData.push({
                product,
                variant,
                productId,
                variantId: variant ? variant.id : null,
                size: variant?.value ? String(variant.value) : raw.size ?? raw.selected_size ?? null,
                quantity,
                unitPrice,
            });
            totalAmount += unitPrice * quantity;
        }

        try {
            allocateOrderEntries(orderItemsData);
        } catch (allocationError) {
            return Response.json(
                { success: false, message: allocationError.message },
                { status: allocationError.status || 400 }
            );
        }

        let computedShippingFee = null;
        try {
            const rates = await prisma.shippingCost.findFirst({ orderBy: { createdAt: "desc" } });
            if (rates) {
                if (rates.oneShippingCost !== null) {
                    computedShippingFee = Number(rates.oneShippingCost);
                } else if (district) {
                    computedShippingFee = String(district).trim().toLowerCase() === "dhaka" ? Number(rates.insideDhaka) : Number(rates.outsideDhaka);
                }
            }
        } catch (rateError) {
            console.error("Shipping rate lookup failed:", rateError);
        }

        const finalShippingFee = computedShippingFee !== null && Number.isFinite(computedShippingFee) ? computedShippingFee : Number(shippingFee) || 0;
        const finalAdvancePayment = Number(advancePayment) || 0;

        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.order.create({
                data: {
                    userId: isGuest ? null : auth.user.userId,
                    guestName: isGuest ? finalContactName : null,
                    guestPhone: isGuest ? finalContact.phone : null,
                    contactName: finalContactName,
                    contactPhone: finalContact.phone,
                    contactEmail: finalContact.email,
                    status: "PENDING",
                    paymentStatus: "PENDING",
                    totalAmount: totalAmount + finalShippingFee,
                    shippingFee: finalShippingFee,
                    shippingAddress: finalShippingAddress,
                    district: district ? String(district).trim() : null,
                    advancePayment: finalAdvancePayment,
                    paymentMethod: String(paymentMethod),
                    items: {
                        create: orderItemsData.map((item) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            size: item.size ? String(item.size) : null,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            isPreorder: item.isPreorder,
                            preorderQuantity: item.preorderQuantity,
                        })),
                    },
                },
                include: ORDER_INCLUDE,
            });

            for (const item of orderItemsData) {
                if (item.variantId !== null && item.stockQuantity > 0) {
                    const updatedVariant = await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            stock: { decrement: item.stockQuantity },
                            ...(item.preorderQuantity > 0
                                ? { preorderCount: { increment: item.preorderQuantity } }
                                : {}),
                        },
                    });

                    await tx.stockMovement.create({
                        data: {
                            productVariantId: item.variantId,
                            type: "sale",
                            quantity: -item.stockQuantity,
                            stockAfter: updatedVariant.stock,
                            reservedAfter: updatedVariant.held,
                            orderId: createdOrder.id,
                            note: "Order placed",
                            userId: isGuest ? null : auth.user.userId,
                        },
                    });
                } else if (item.variantId !== null && item.preorderQuantity > 0) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: { preorderCount: { increment: item.preorderQuantity } },
                    });
                }

                if (item.stockQuantity > 0) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.stockQuantity } },
                    });
                }
            }

            if (cartId) {
                await tx.cartItem.deleteMany({ where: { cartId } });
            }

            return createdOrder;
        });

        // The cart behind this order is no longer abandoned: link the tracking
        // row to the finished order so it drops out of Incomplete orders.
        // Strictly best-effort - the order is already committed, this never
        // creates a row, and a failure here can never roll back the order.
        try {
            const cookieStore = await cookies();
            const cartSessionId = cookieStore.get(CART_COOKIE_NAME)?.value || null;

            await syncAbandonedCheckout({
                sessionId: cartSessionId,
                userId: isGuest ? null : auth.user.userId,
                createIfMissing: false,
                orderId: order.id,
            });
        } catch (abandonedError) {
            console.error("Failed to close abandoned checkout:", abandonedError);
        }

        return Response.json({ success: true, message: "Order placed successfully. Cash on delivery.", data: formatOrder(order) }, { status: 201 });
    } catch (error) {
        console.error("Create order API error:", error);
        return Response.json({ success: false, message: "Failed to place order." }, { status: 500 });
    }
}