import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatDate(date) {
    if (!date) return null;

    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");

    return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function formatCustomer(c) {
    return {
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        district: c.district,
        total_orders: c.totalOrders,
        total_spent: c.totalSpent,
        last_order_date: c.lastOrderDate
            ? formatDate(c.lastOrderDate)
            : null,
        last_ordered_products: c.lastOrderedProducts,
        badge: c.badge,
        assigned_badge: c.assignedBadge,
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
            Math.max(1, Number(searchParams.get("per_page") ?? 15))
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
                shippingAddress: true,
                district: true,
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
                items: {
                    select: {
                        productId: true,
                        quantity: true,
                        unitPrice: true,
                        product: {
                            select: {
                                name: true,
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
            orderBy: { createdAt: "desc" },
        });

        const customerMap = new Map();

        for (const o of orders) {
            let key;
            let userId = null;
            let name = "";
            let phone = "";
            let email = null;
            let badge = null;
            let assignedBadge = null;

            if (o.userId && o.user) {
                key = `user:${o.userId}`;
                userId = o.user.id;
                name = o.user.name ?? "";
                phone = o.user.phone ?? "";
                email = o.user.email ?? null;
                badge = o.user.badge ?? null;
                assignedBadge = o.user.badge ?? null;
            } else {
                key = `guest:${o.guestPhone ?? "unknown"}`;
                name = o.guestName ?? "";
                phone = o.guestPhone ?? "";
                badge = o.assignedBadge ?? null;
                assignedBadge = o.assignedBadge ?? null;
            }

            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    key,
                    userId,
                    name,
                    phone,
                    email,
                    address: o.shippingAddress ?? null,
                    district: o.district ?? null,
                    badge,
                    assignedBadge,
                    totalOrders: 0,
                    totalSpent: 0,
                    lastOrderDate: o.createdAt,
                    lastOrderedProducts: [],
                });
            }

            const entry = customerMap.get(key);

            entry.totalOrders += 1;

            if (o.status !== "CANCELLED") {
                entry.totalSpent += Number(o.totalAmount);
            }

            if (o.createdAt > entry.lastOrderDate) {
                entry.lastOrderDate = o.createdAt;
                entry.address = o.shippingAddress ?? entry.address;
                entry.district = o.district ?? entry.district;
            }

            if (!entry.badge && badge) {
                entry.badge = badge;
            }

            if (!entry.assignedBadge && assignedBadge) {
                entry.assignedBadge = assignedBadge;
            }
        }

        for (const o of orders) {
            let key;

            if (o.userId) {
                key = `user:${o.userId}`;
            } else {
                key = `guest:${o.guestPhone ?? "unknown"}`;
            }

            const entry = customerMap.get(key);

            if (!entry) continue;

            if (o.createdAt.getTime() !== entry.lastOrderDate.getTime()) {
                continue;
            }

            entry.lastOrderedProducts = o.items.map((item) => ({
                title: item.product?.name ?? null,
                qty: item.quantity,
                unitPrice: Number(item.unitPrice).toFixed(2),
                totalPrice: (
                    Number(item.unitPrice) * item.quantity
                ).toFixed(2),
                colorImage:
                    item.product?.images?.[0]?.imageUrl ?? null,
                selected_size: null,
            }));
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
                (a, b) =>
                    new Date(b.lastOrderDate) - new Date(a.lastOrderDate)
            );
        } else if (sort === "name") {
            customers.sort((a, b) =>
                (a.name ?? "").localeCompare(b.name ?? "")
            );
        }

        const total = customers.length;
        const lastPage = Math.ceil(total / perPage);
        const paginated = customers.slice(skip, skip + perPage);

        return Response.json({
            success: true,
            data: paginated.map(formatCustomer),
            pagination: {
                current_page: page,
                per_page: perPage,
                total,
                last_page: lastPage,
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