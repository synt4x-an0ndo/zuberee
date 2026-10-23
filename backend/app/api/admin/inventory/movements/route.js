import prisma from "../../../../../directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

function formatVariantMovement(m, userNames) {
    const color = m.variant.product.colors?.find((entry) => entry.id === m.variant.colorId) ?? null;
    return {
        id: `variant-${m.id}`,
        product_variant_id: m.productVariantId,
        product_id: m.variant.productId,
        variant_label: color?.name ? `${color.name} / ${m.variant.value}` : `${m.variant.value}`,
        product_level: false,
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
        product: { id: m.variant.product.id, title: m.variant.product.name, sku: m.variant.product.sku },
        variant: { id: m.variant.id, product_id: m.variant.productId, available: Math.max(0, m.variant.stock - m.variant.held), color, size: { id: m.variant.id, size: m.variant.value } },
        user: m.userId ? { id: m.userId, name: userNames.get(m.userId) ?? "Unknown user" } : null,
    };
}

function formatProductMovement(m, userNames) {
    return {
        id: `product-${m.id}`,
        product_variant_id: null,
        product_id: m.productId,
        variant_label: "Product stock",
        product_level: true,
        type: m.type,
        quantity: m.quantity,
        stock_after: m.stockAfter,
        reserved_after: 0,
        unit_cost: null,
        order_id: m.orderId,
        order_item_id: null,
        user_id: m.userId,
        note: m.note,
        created_at: m.createdAt,
        product: { id: m.product.id, title: m.product.name, sku: m.product.sku },
        variant: null,
        user: m.userId ? { id: m.userId, name: userNames.get(m.userId) ?? "Unknown user" } : null,
    };
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json({ message: "Admin access required." }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") ?? 40)));
        const skip = (page - 1) * perPage;
        // Fetch enough of each independently ordered ledger to form this page
        // after their timestamps are merged. Both ledgers remain append-only.
        const take = skip + perPage;
        const [variantMovements, productMovements, variantTotal, productTotal] = await Promise.all([
            prisma.stockMovement.findMany({
                orderBy: [{ createdAt: "desc" }, { id: "desc" }], take,
                include: { variant: { include: { product: { include: { colors: true } } } } },
            }),
            prisma.productStockMovement.findMany({
                orderBy: [{ createdAt: "desc" }, { id: "desc" }], take,
                include: { product: { select: { id: true, name: true, sku: true } } },
            }),
            prisma.stockMovement.count(),
            prisma.productStockMovement.count(),
        ]);
        const movementRows = [
            ...variantMovements.map((movement) => ({ kind: "variant", movement })),
            ...productMovements.map((movement) => ({ kind: "product", movement })),
        ].sort((a, b) => b.movement.createdAt - a.movement.createdAt || b.movement.id - a.movement.id)
            .slice(skip, skip + perPage);
        const userIds = [...new Set(movementRows.map(({ movement }) => movement.userId).filter(Number.isInteger))];
        const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
        const userNames = new Map(users.map((user) => [user.id, user.name]));
        const total = variantTotal + productTotal;
        return Response.json({
            message: "success",
            data: {
                current_page: page,
                data: movementRows.map(({ kind, movement }) => kind === "variant" ? formatVariantMovement(movement, userNames) : formatProductMovement(movement, userNames)),
                last_page: Math.max(1, Math.ceil(total / perPage)),
                per_page: perPage,
                total,
            },
        });
    } catch (error) {
        console.error("Get stock movements API error:", error);
        return Response.json({ message: "Failed to load stock movements." }, { status: 500 });
    }
}
