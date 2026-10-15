import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const orders = await prisma.order.findMany({
            select: {
                id: true,
                userId: true,
                guestPhone: true,
                totalAmount: true,
                status: true,
            },
        });

        const validOrders = orders.filter(
            (o) => o.status !== "CANCELLED"
        );

        const customerMap = new Map();

        for (const o of orders) {
            let key;

            if (o.userId) {
                key = `user:${o.userId}`;
            } else {
                key = `guest:${o.guestPhone ?? "unknown"}`;
            }

            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    key,
                    totalOrders: 0,
                });
            }

            customerMap.get(key).totalOrders += 1;
        }

        const totalCustomers = customerMap.size;

        let newCustomers = 0;
        let repeatCustomers = 0;

        for (const c of customerMap.values()) {
            if (c.totalOrders >= 2) {
                repeatCustomers += 1;
            } else {
                newCustomers += 1;
            }
        }

        const totalOrders = orders.length;

        const totalRevenue = validOrders.reduce(
            (sum, o) => sum + Number(o.totalAmount),
            0
        );

        const averageOrderValue =
            validOrders.length > 0
                ? totalRevenue / validOrders.length
                : 0;

        return Response.json({
            success: true,
            data: {
                total_customers: totalCustomers,
                total_orders: totalOrders,
                total_revenue: Math.round(totalRevenue),
                average_order_value: Number(
                    averageOrderValue.toFixed(4)
                ),
                new_customers: newCustomers,
                repeat_customers: repeatCustomers,
            },
        });
    } catch (error) {
        console.error("Customer statistics API error:", error);

        return Response.json(
            { success: false, message: "Failed to load statistics." },
            { status: 500 }
        );
    }
}