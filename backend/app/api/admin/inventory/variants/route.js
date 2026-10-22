import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

const VALID_FILTERS = ["all", "in_stock", "low_stock", "out_of_stock", "preorder", "tracked"];
const DEFAULT_LOW_STOCK_THRESHOLD = 3;

function productMeta(product, trackInventory) {
    const firstImage = product.images?.[0];
    return {
        id: product.id,
        title: product.name,
        sku: product.sku,
        status: product.status.toLowerCase().replaceAll("_", "-"),
        track_inventory: trackInventory,
        first_image: firstImage ? { id: firstImage.id, product_id: product.id, image: firstImage.imageUrl } : null,
    };
}

function formatVariant(variant) {
    const available = Math.max(0, variant.stock - variant.held);
    const threshold = variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    const color = variant.product?.colors?.find((entry) => entry.id === variant.colorId);
    return {
        id: variant.id,
        product_id: variant.productId,
        product_color_id: variant.colorId ?? null,
        size_id: variant.id,
        variant_key: `${variant.colorId ?? 0}-${variant.id}`,
        sku: variant.product?.sku ?? null,
        price: variant.price === null ? null : Number(variant.price),
        purchase_price: null,
        stock: variant.stock,
        reserved: variant.reserved,
        held: variant.held,
        available,
        low_stock_threshold: variant.lowStockThreshold,
        allow_preorder: variant.allowPreorder,
        preorder_limit: variant.preorderLimit,
        preorder_count: variant.preorderCount,
        is_active: variant.isActive,
        position: variant.position,
        created_at: variant.createdAt,
        updated_at: variant.updatedAt,
        label: color?.name ? `${color.name} / ${variant.value}` : variant.value,
        low_stock: available > 0 && available <= threshold,
        product_level: false,
        product: productMeta(variant.product, true),
        color: color ? { id: color.id, name: color.name, code: color.code, image: color.image } : null,
        size: { id: variant.id, size: variant.value },
    };
}

function formatProductLevel(product) {
    const available = Math.max(0, product.stock);
    const threshold = DEFAULT_LOW_STOCK_THRESHOLD;
    return {
        // Prefix prevents a product-level row from colliding with a variant id.
        id: `product-${product.id}`,
        product_id: product.id,
        product_color_id: null,
        size_id: null,
        variant_key: `product-${product.id}`,
        sku: product.sku ?? null,
        price: Number(product.price),
        purchase_price: null,
        stock: product.stock,
        reserved: 0,
        held: 0,
        available,
        low_stock_threshold: threshold,
        allow_preorder: product.status === "PRE_ORDER",
        preorder_limit: null,
        preorder_count: 0,
        is_active: product.isActive,
        position: 0,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
        label: "Product stock",
        low_stock: available > 0 && available <= threshold,
        product_level: true,
        product: productMeta(product, Boolean(product.inventory?.trackInventory)),
        color: null,
        size: null,
    };
}

function matchesFilter(row, filter) {
    switch (filter) {
        case "in_stock": return row.available > 0;
        case "out_of_stock": return row.available <= 0;
        case "low_stock": return row.low_stock;
        case "preorder": return row.allow_preorder || row.product?.status === "pre-order";
        case "tracked": return row.product?.track_inventory === true;
        default: return true;
    }
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json({ message: "failed", data: "Admin access required." }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim();
        const filter = searchParams.get("filter")?.trim() ?? "all";
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") ?? 30)));
        if (!VALID_FILTERS.includes(filter)) return Response.json({ message: "failed", data: "Invalid filter." }, { status: 400 });

        const productSelect = {
            id: true, name: true, sku: true, status: true, price: true, stock: true, isActive: true, createdAt: true, updatedAt: true,
            images: { orderBy: { isPrimary: "desc" }, take: 1, select: { id: true, imageUrl: true } },
            colors: { select: { id: true, name: true, code: true, image: true } },
            inventory: { select: { trackInventory: true } },
        };
        const searchWhere = search ? {
            OR: [
                { value: { contains: search, mode: "insensitive" } },
                { product: { name: { contains: search, mode: "insensitive" } } },
                { product: { sku: { contains: search, mode: "insensitive" } } },
            ],
        } : {};
        const productSearchWhere = search ? {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ],
        } : {};
        const [variants, productRows] = await Promise.all([
            prisma.productVariant.findMany({
                where: { AND: [searchWhere, { product: { inventory: { is: { trackInventory: true } } } }] },
                orderBy: [{ productId: "asc" }, { position: "asc" }],
                include: { product: { select: productSelect } },
            }),
            prisma.product.findMany({
                where: { AND: [productSearchWhere, { OR: [{ inventory: { is: { trackInventory: false } } }, { inventory: { is: null } }, { variants: { none: {} } }] }] },
                orderBy: { id: "asc" },
                select: productSelect,
            }),
        ]);
        const rows = [...variants.map(formatVariant), ...productRows.map(formatProductLevel)].filter((row) => matchesFilter(row, filter));
        rows.sort((a, b) => (a.product_id - b.product_id) || String(a.id).localeCompare(String(b.id)));
        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const start = (page - 1) * perPage;
        return Response.json({ message: "success", data: { current_page: page, data: rows.slice(start, start + perPage), has_more: page < totalPages, per_page: perPage, total, total_pages: totalPages } });
    } catch (error) {
        console.error("Inventory variants API error:", error);
        return Response.json({ message: "failed", data: null }, { status: 500 });
    }
}
