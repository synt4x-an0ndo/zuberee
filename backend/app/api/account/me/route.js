import prisma from "../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.user.userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                addresses: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        fullName: true,
                        phone: true,
                        addressLine: true,
                        city: true,
                        postalCode: true,
                        country: true,
                        createdAt: true,
                    },
                },
                _count: {
                    select: { orders: true },
                },
            },
        });

        if (!user) {
            return Response.json(
                {
                    success: false,
                    message: "User not found.",
                    data: null,
                },
                { status: 404 }
            );
        }

        const deliveredCount = await prisma.order.count({
            where: {
                userId: user.id,
                status: "DELIVERED",
            },
        });

        const pendingCount = await prisma.order.count({
            where: {
                userId: user.id,
                status: {
                    in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"],
                },
            },
        });

        return Response.json(
            {
                success: true,
                message: "User profile loaded.",
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    image: user.image,
                    role: user.role.toLowerCase(),
                    joined_at: user.createdAt,
                    updated_at: user.updatedAt,
                    addresses: user.addresses.map((addr) => ({
                        id: addr.id,
                        full_name: addr.fullName,
                        phone: addr.phone,
                        address_line: addr.addressLine,
                        city: addr.city,
                        postal_code: addr.postalCode,
                        country: addr.country,
                        created_at: addr.createdAt,
                    })),
                    stats: {
                        total_orders: user._count.orders,
                        pending_orders: pendingCount,
                        delivered_orders: deliveredCount,
                        wishlist: 0,
                    },
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get profile API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load user profile.",
                data: null,
            },
            { status: 500 }
        );
    }
}