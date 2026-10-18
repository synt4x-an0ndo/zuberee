import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatMovement(m, userNames) {
    // The variant's own colour (matched by colorId, as inventory/variants does) —
    // not the product's first colour, which mislabels every other colour.
    const color =
        m.variant.product.colors?.find((c) => c.id === m.variant.colorId) ??
        null;
    return {
        id: m.id,
        product_variant_id: m.productVariantId,
        product_id: m.variant.productId,
        variant_label: color?.name
            ? `${color.name} / ${m.variant.value}`
            : `${m.variant.value}`,
        type: m.type,
        quantity: m.quantity,
        stock_after: m.stockAfter,
        reserved_after: m.reservedAfter,
        unit_cost: null,
        order_id: m.orderId,
        order_item_id: null,
        user_id: m.userId,
        note: m.note,
        created_at: m.createdAt,
        product: {
            id: m.variant.product.id,
            title: m.variant.product.name,
            sku: m.variant.product.sku,
        },
        variant: {
            id: m.variant.id,
            product_id: m.variant.productId,
            available: Math.max(0, m.variant.stock - m.variant.held),
            color,
            size: {
                id: m.variant.id,
                size: m.variant.value
            }
        },
        user: m.userId ? { id: m.userId, name: userNames.get(m.userId) ?? "Unknown user" } : null,
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json({ message: "Admin access required." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") ?? 40)));
        const skip = (page - 1) * perPage;

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
                include: {
                    variant: {
                        include: {
                            product: {
                                include: {
                                    colors: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.stockMovement.count(),
        ]);

        // StockMovement.userId has no Prisma relation, so resolve real names
        // in one query instead of hardcoding "Admin".
        const userIds = [...new Set(movements.map((m) => m.userId).filter(Number.isInteger))];
        const users = userIds.length
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
            : [];
        const userNames = new Map(users.map((u) => [u.id, u.name]));

        const lastPage = Math.ceil(total / perPage);

        return Response.json({
            message: "success",
            data: {
                current_page: page,
                data: movements.map((m) => formatMovement(m, userNames)),
                last_page: lastPage,
                per_page: perPage,
                total,
            },
        });
    } catch (error) {
        console.error("Get stock movements API error:", error);
        return Response.json({ message: "Failed to load stock movements." }, { status: 500 });
    }
}