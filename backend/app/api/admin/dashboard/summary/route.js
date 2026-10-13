import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

const VALID_RANGES = ["today", "week", "month", "year", "custom"];

const VALID_ORDER_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
];

function getDateRange(range, fromParam, toParam) {
    const now = new Date();
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    let from = new Date(now);
    from.setHours(0, 0, 0, 0);

    switch (range) {
        case "today":
            break;
        case "week": {
            const day = from.getDay();
            const diff = day === 0 ? 6 : day - 1;
            from.setDate(from.getDate() - diff);
            break;
        }
        case "month":
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case "year":
            from = new Date(now.getFullYear(), 0, 1);
            break;
        case "custom":
            if (fromParam) {
                from = new Date(fromParam);
                from.setHours(0, 0, 0, 0);
            }
            if (toParam) {
                const customTo = new Date(toParam);
                customTo.setHours(23, 59, 59, 999);
                return { from, to: customTo };
            }
            break;
    }

    return { from, to };
}

function formatDateKey(date) {
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
                { message: "failed", data: "Admin access required." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);

        const range = searchParams.get("range")?.trim() ?? "month";
        const hotLimitRaw = Number(searchParams.get("hot_limit") ?? 5);
        const hotLimit = Number.isInteger(hotLimitRaw)
            ? Math.min(10, Math.max(1, hotLimitRaw))
            : 5;

        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");

        if (!VALID_RANGES.includes(range)) {
            return Response.json(
                { message: "failed", data: "Invalid range." },
                { status: 400 }
            );
        }

        const { from, to } = getDateRange(range, fromParam, toParam);

        const orders = await prisma.order.findMany({
            where: {
                createdAt: {
                    gte: from,
                    lte: to,
                },
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                            },
                        },
                    },
                },
                user: {
                    select: { id: true },
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

        const totalOrders = orders.length;

        const unitsSold = validOrders.reduce(
            (sum, o) =>
                sum +
                o.items.reduce((s, item) => s + item.quantity, 0),
            0
        );

        const customerIds = new Set();
        for (const o of orders) {
            if (o.userId) customerIds.add(o.userId);
            else if (o.guestPhone) customerIds.add(`guest:${o.guestPhone}`);
        }

        const averageOrderValue =
            validOrders.length > 0
                ? Math.round(grossSales / validOrders.length)
                : 0;

        const trendMap = new Map();

        for (const o of validOrders) {
            const key = formatDateKey(new Date(o.createdAt));

            if (!trendMap.has(key)) {
                trendMap.set(key, { date: key, sales: 0, orders: 0 });
            }

            const entry = trendMap.get(key);
            entry.sales += Number(o.totalAmount);
            entry.orders += 1;
        }

        const salesTrend = Array.from(trendMap.values()).sort(
            (a, b) => a.date.localeCompare(b.date)
        );

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

        const statusBreakdown = Array.from(statusMap.values())
            .map((entry) => ({
                status: entry.status,
                orders: entry.orders,
                sales: entry.sales,
                percentage:
                    totalOrders > 0
                        ? Math.round((entry.orders / totalOrders) * 100)
                        : 0,
            }))
            .sort((a, b) => b.orders - a.orders);

        const productMap = new Map();

        for (const o of validOrders) {
            for (const item of o.items) {
                const key = item.productId;

                if (!productMap.has(key)) {
                    productMap.set(key, {
                        product_id: key,
                        title: item.product?.name ?? "Unknown",
                        quantity_sold: 0,
                        order_lines: 0,
                        sales: 0,
                    });
                }

                const entry = productMap.get(key);
                entry.quantity_sold += item.quantity;
                entry.order_lines += 1;
                entry.sales += Number(item.unitPrice) * item.quantity;
            }
        }

        const topProducts = Array.from(productMap.values())
            .sort((a, b) => b.sales - a.sales)
            .slice(0, hotLimit);

        return Response.json({
            message: "success",
            data: {
                range: {
                    from: from.toISOString().slice(0, 19).replace("T", " "),
                    to: to.toISOString().slice(0, 19).replace("T", " "),
                    timezone: "Asia/Dhaka",
                },
                totals: {
                    gross_sales: grossSales,
                    orders: totalOrders,
                    units_sold: unitsSold,
                    customers: customerIds.size,
                    average_order_value: averageOrderValue,
                    shipping_collected: shippingCollected,
                },
                changes: {
                    gross_sales: null,
                    orders: null,
                    units_sold: null,
                    customers: null,
                },
                sales_trend: salesTrend,
                status_breakdown: statusBreakdown,
                top_products: topProducts,
            },
        });
    } catch (error) {
        console.error("Dashboard summary API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}