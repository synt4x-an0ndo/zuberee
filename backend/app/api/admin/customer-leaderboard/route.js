import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatCustomer(c) {
    return {
        id: c.key,
        user_id: c.userId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        badge: c.badge,
        is_guest: c.userId === null,
        total_orders: c.totalOrders,
        total_spent: c.totalSpent,
        delivered_orders: c.deliveredOrders,
        cancelled_orders: c.cancelledOrders,
        first_order_at: c.firstOrderAt,
        last_order_at: c.lastOrderAt,
    };
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

        const search = searchParams.get("search")?.trim();
        const sort = searchParams.get("sort")?.trim() ?? "total_spent";
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(
            100,
            Math.max(1, Number(searchParams.get("per_page") ?? 50))
        );

        const skip = (page - 1) * perPage;

        const orders = await prisma.order.findMany({
            select: {
                id: true,
                userId: true,
                guestName: true,
                guestPhone: true,
                totalAmount: true,
                status: true,
                assignedBadge: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                        badge: true,
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const customerMap = new Map();

        for (const o of orders) {
            let key;
            let userId = null;
            let name = "";
            let phone = "";
            let email = null;
            let badge = null;

            if (o.userId && o.user) {
                key = `user:${o.userId}`;
                userId = o.user.id;
                name = o.user.name ?? "";
                phone = o.user.phone ?? "";
                email = o.user.email ?? null;
                badge = o.user.badge ?? null;
            } else {
                key = `guest:${o.guestPhone ?? "unknown"}`;
                name = o.guestName ?? "";
                phone = o.guestPhone ?? "";
                badge = o.assignedBadge ?? null;
            }

            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    key,
                    userId,
                    name,
                    phone,
                    email,
                    badge,
                    totalOrders: 0,
                    totalSpent: 0,
                    deliveredOrders: 0,
                    cancelledOrders: 0,
                    firstOrderAt: o.createdAt,
                    lastOrderAt: o.createdAt,
                });
            }

            const entry = customerMap.get(key);

            entry.totalOrders += 1;

            if (o.status !== "CANCELLED") {
                entry.totalSpent += Number(o.totalAmount);
            }

            if (o.status === "DELIVERED") {
                entry.deliveredOrders += 1;
            }

            if (o.status === "CANCELLED") {
                entry.cancelledOrders += 1;
            }

            if (o.createdAt < entry.firstOrderAt) {
                entry.firstOrderAt = o.createdAt;
            }

            if (o.createdAt > entry.lastOrderAt) {
                entry.lastOrderAt = o.createdAt;
            }
        }

        let customers = Array.from(customerMap.values());

        if (search) {
            const searchLower = search.toLowerCase();

            customers = customers.filter((c) => {
                return (
                    c.name?.toLowerCase().includes(searchLower) ||
                    c.phone?.toLowerCase().includes(searchLower) ||
                    c.email?.toLowerCase().includes(searchLower)
                );
            });
        }

        if (sort === "total_spent") {
            customers.sort((a, b) => b.totalSpent - a.totalSpent);
        } else if (sort === "total_orders") {
            customers.sort((a, b) => b.totalOrders - a.totalOrders);
        } else if (sort === "last_order") {
            customers.sort(
                (a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt)
            );
        } else if (sort === "name") {
            customers.sort((a, b) =>
                (a.name ?? "").localeCompare(b.name ?? "")
            );
        }

        const total = customers.length;
        const totalPages = Math.ceil(total / perPage);
        const paginated = customers.slice(skip, skip + perPage);

        return Response.json({
            success: true,
            message: "Customer leaderboard loaded.",
            data: paginated.map(formatCustomer),
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
        console.error("Customer leaderboard API error:", error);

        return Response.json(
            { success: false, message: "Failed to load customer leaderboard." },
            { status: 500 }
        );
    }
}