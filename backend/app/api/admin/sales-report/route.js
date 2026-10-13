import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function getDateRange(startParam, endParam) {
    const now = new Date();
    const defaultTo = new Date(now);
    defaultTo.setHours(23, 59, 59, 999);

    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    defaultFrom.setHours(0, 0, 0, 0);

    let from = defaultFrom;
    let to = defaultTo;

    if (startParam) {
        const parsed = new Date(startParam);
        if (!Number.isNaN(parsed.getTime())) {
            parsed.setHours(0, 0, 0, 0);
            from = parsed;
        }
    }

    if (endParam) {
        const parsed = new Date(endParam);
        if (!Number.isNaN(parsed.getTime())) {
            parsed.setHours(23, 59, 59, 999);
            to = parsed;
        }
    }

    return { from, to };
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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

        const startDate = searchParams.get("start_date")?.trim();
        const endDate = searchParams.get("end_date")?.trim();
        const statusFilter = searchParams.get("status")?.trim();
        const productSearch = searchParams.get("product")?.trim();
        const sort = searchParams.get("sort")?.trim() ?? "revenue";

        const { from, to } = getDateRange(startDate, endDate);

        const orderWhere = {
            createdAt: {
                gte: from,
                lte: to,
            },
        };

        if (statusFilter && statusFilter !== "all") {
            orderWhere.status = statusFilter.toUpperCase().replace("-", "_");
        }

        const orders = await prisma.order.findMany({
            where: orderWhere,
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                status: true,
                                images: {
                                    orderBy: { isPrimary: "desc" },
                                    take: 1,
                                    select: { imageUrl: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        const validOrders = orders.filter(
            (o) => o.status !== "CANCELLED"
        );

        const grossSales = validOrders.reduce(
            (sum, o) => sum + Number(o.totalAmount),
            0
        );

        const shippingCollected = validOrders.reduce(
            (sum, o) => sum + Number(o.shippingFee),
            0
        );

        const unitsSold = validOrders.reduce(
            (sum, o) =>
                sum + o.items.reduce((s, item) => s + item.quantity, 0),
            0
        );

        const customerSet = new Set();
        for (const o of orders) {
            if (o.userId) customerSet.add(`user:${o.userId}`);
            else if (o.guestPhone) customerSet.add(`guest:${o.guestPhone}`);
        }

        const averageOrderValue =
            validOrders.length > 0
                ? Math.round(grossSales / validOrders.length)
                : 0;

        const productsOrderedSet = new Set();
        for (const o of validOrders) {
            for (const item of o.items) {
                productsOrderedSet.add(item.productId);
            }
        }

        const productMap = new Map();

        for (const o of validOrders) {
            for (const item of o.items) {
                const key = item.productId;

                if (!productMap.has(key)) {
                    const firstImage =
                        item.product?.images?.[0]?.imageUrl ?? null;

                    productMap.set(key, {
                        product_id: key,
                        title: item.product?.name ?? "Unknown",
                        sku: item.product?.sku ?? null,
                        product_status: item.product?.status
                            ? item.product.status.toLowerCase().replace("_", "-")
                            : null,
                        image: firstImage,
                        order_count: 0,
                        customer_count: 0,
                        quantity_sold: 0,
                        gross_sales: 0,
                        average_unit_price: 0,
                        last_ordered_at: null,
                        customerSet: new Set(),
                    });
                }

                const entry = productMap.get(key);
                const lineTotal =
                    Number(item.unitPrice) * item.quantity;

                entry.order_count += 1;
                entry.quantity_sold += item.quantity;
                entry.gross_sales += lineTotal;

                if (o.userId) entry.customerSet.add(`user:${o.userId}`);
                else if (o.guestPhone) entry.customerSet.add(`guest:${o.guestPhone}`);

                if (
                    !entry.last_ordered_at ||
                    new Date(o.createdAt) > new Date(entry.last_ordered_at)
                ) {
                    entry.last_ordered_at = o.createdAt;
                }
            }
        }

        let products = Array.from(productMap.values()).map((p) => ({
            product_id: p.product_id,
            title: p.title,
            sku: p.sku,
            product_status: p.product_status,
            image: p.image,
            order_count: p.order_count,
            customer_count: p.customerSet.size,
            quantity_sold: p.quantity_sold,
            gross_sales: p.gross_sales,
            average_unit_price:
                p.quantity_sold > 0
                    ? Math.round(p.gross_sales / p.quantity_sold)
                    : 0,
            last_ordered_at: p.last_ordered_at,
        }));

        if (sort === "revenue") {
            products.sort((a, b) => b.gross_sales - a.gross_sales);
        } else if (sort === "quantity") {
            products.sort((a, b) => b.quantity_sold - a.quantity_sold);
        } else if (sort === "orders") {
            products.sort((a, b) => b.order_count - a.order_count);
        }

        if (productSearch) {
            products = products.filter(
                (p) =>
                    p.title?.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
            );
        }

        const dailyMap = new Map();

        for (const o of validOrders) {
            const key = formatDate(new Date(o.createdAt));

            if (!dailyMap.has(key)) {
                dailyMap.set(key, {
                    date: key,
                    orders: 0,
                    sales: 0,
                    customerSet: new Set(),
                });
            }

            const entry = dailyMap.get(key);
            entry.orders += 1;
            entry.sales += Number(o.totalAmount);

            if (o.userId) entry.customerSet.add(`user:${o.userId}`);
            else if (o.guestPhone) entry.customerSet.add(`guest:${o.guestPhone}`);
        }

        const dailySales = Array.from(dailyMap.values())
            .map((d) => ({
                date: d.date,
                orders: d.orders,
                sales: d.sales,
                customers: d.customerSet.size,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // =====================================================
        // STATUS BREAKDOWN
        // =====================================================

        const statusMap = new Map();

        for (const o of orders) {
            const status = o.status.toLowerCase();

            if (!statusMap.has(status)) {
                statusMap.set(status, {
                    status,
                    orders: 0,
                    sales: 0,
                });
            }

            const entry = statusMap.get(status);
            entry.orders += 1;
            entry.sales += Number(o.totalAmount);
        }

        const statusBreakdown = Array.from(statusMap.values()).sort(
            (a, b) => b.orders - a.orders
        );

        return Response.json({
            success: true,
            message: "Sales report loaded.",
            data: {
                range: {
                    from: formatDate(from),
                    to: formatDate(to),
                    timezone: "Asia/Dhaka",
                },
                summary: {
                    gross_sales: grossSales,
                    orders: validOrders.length,
                    units_sold: unitsSold,
                    customers: customerSet.size,
                    average_order_value: averageOrderValue,
                    shipping_collected: shippingCollected,
                    products_ordered: productsOrderedSet.size,
                },
                products,
                daily_sales: dailySales,
                status_breakdown: statusBreakdown,
            },
        });
    } catch (error) {
        console.error("Sales report API error:", error);

        return Response.json(
            { success: false, message: "Failed to load sales report." },
            { status: 500 }
        );
    }
}