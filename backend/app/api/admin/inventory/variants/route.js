import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

const VALID_FILTERS = [
    "all",
    "in_stock",
    "low_stock",
    "out_of_stock",
    "preorder",
    "tracked",
];

const DEFAULT_LOW_STOCK_THRESHOLD = 3;

function formatVariant(variant) {
    const available = Math.max(0, variant.stock - variant.held);
    const threshold =
        variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    const trackInv =
        variant.trackInventory ||
        variant.product?.inventory?.trackInventory ||
        false;

    const isLowStock =
        trackInv && available > 0 && available <= threshold;

    const color = variant.product?.colors?.find(
        (c) => c.id === variant.colorId
    );

    const firstImage = variant.product?.images?.[0];

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
        label: `${color?.name ?? ""} / ${variant.value}`,
        low_stock: isLowStock,
        product: variant.product
            ? {
                id: variant.product.id,
                title: variant.product.name,
                sku: variant.product.sku,
                status: variant.product.status
                    .toLowerCase()
                    .replaceAll("_", "-"),
                track_inventory: trackInv,
                first_image: firstImage
                    ? {
                        id: firstImage.id,
                        product_id: variant.productId,
                        image: firstImage.imageUrl,
                    }
                    : null,
            }
            : null,
        color: color
            ? {
                id: color.id,
                name: color.name,
                code: color.code,
                image: color.image,
            }
            : null,
        size: {
            id: variant.id,
            size: variant.value,
        },
    };
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

        const search = searchParams.get("search")?.trim();
        const filter = searchParams.get("filter")?.trim() ?? "all";
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const perPage = Math.min(
            100,
            Math.max(1, Number(searchParams.get("per_page") ?? 30))
        );

        if (!VALID_FILTERS.includes(filter)) {
            return Response.json(
                { message: "failed", data: "Invalid filter." },
                { status: 400 }
            );
        }

        const skip = (page - 1) * perPage;

        const where = {
            ...(search
                ? {
                    OR: [
                        {
                            value: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            product: {
                                name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                        {
                            product: {
                                sku: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                    ],
                }
                : {}),
        };

        const [variants, total] = await Promise.all([
            prisma.productVariant.findMany({
                where,
                orderBy: [
                    { productId: "asc" },
                    { position: "asc" },
                ],
                skip,
                take: perPage,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            status: true,
                            price: true,
                            images: {
                                orderBy: { isPrimary: "desc" },
                                take: 1,
                                select: {
                                    id: true,
                                    imageUrl: true,
                                },
                            },
                            colors: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                    image: true,
                                },
                            },
                            inventory: {
                                select: {
                                    trackInventory: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.productVariant.count({ where }),
        ]);

        const formatted = variants.map(formatVariant);

        const filtered =
            filter === "all"
                ? formatted
                : formatted.filter((v) => {
                    const trackInv = v.product?.track_inventory;

                    switch (filter) {
                        case "in_stock":
                            return v.available > 0;
                        case "out_of_stock":
                            return v.available <= 0;
                        case "low_stock":
                            return v.low_stock === true;
                        case "preorder":
                            return v.allow_preorder === true;
                        case "tracked":
                            return trackInv === true;
                        default:
                            return true;
                    }
                });

        const totalPages = Math.ceil(total / perPage);

        return Response.json({
            message: "success",
            data: {
                current_page: page,
                data: filtered,
                has_more: page < totalPages,
                per_page: perPage,
                total,
                total_pages: totalPages,
            },
        });
    } catch (error) {
        console.error("Inventory variants API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}