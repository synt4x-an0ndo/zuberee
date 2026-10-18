import prisma from "@/directory/prisma/prisma.js";

function formatPaginatedProduct(product) {
    return {
        id: product.id,
        title: product.name,
        sku: product.sku,
        price: Number(product.price),
        discount:
            product.discount === null ? null : Number(product.discount),
        status: product.status.toLowerCase().replaceAll("_", "-"),
        short_description: product.shortDescription,
        description: product.description,
        video_url: product.videoUrl,
        images: product.images.map((image) => ({
            id: image.id,
            image: image.imageUrl,
            position: image.isPrimary ? 0 : 1,
        })),
        colors: product.colors.map((color) => ({
            id: String(color.id),
            name: color.name,
            code: color.code,
            image: color.image,
        })),
        sizes: product.variants.map((variant) => ({
            id: variant.id,
            size: variant.value,
            pivot: {
                product_id: variant.productId,
                size_id: variant.id,
                price:
                    variant.price === null
                        ? null
                        : Number(variant.price),
                stock: variant.stock,
            },
        })),
        track_inventory:
            product.inventory?.trackInventory ?? false,
        category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
                slug: product.category.slug,
            }
            : null,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
    };
}

/**
 * Parse a query-string number defensively.
 * Returns the numeric value, or null when the value is missing/blank
 * or not a finite number (e.g. "10000?" from a malformed URL) so that
 * invalid input is ignored instead of reaching Prisma as NaN.
 */
function toFiniteNumber(value) {
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();
        const category = searchParams.get("category")?.trim();
        const size = searchParams.get("size")?.trim();
        const status = searchParams.get("status")?.trim();

        const minPrice = toFiniteNumber(searchParams.get("min_price"));
        const maxPrice = toFiniteNumber(searchParams.get("max_price"));

        const pageParam = searchParams.get("page");
        const perPageParam = searchParams.get("per_page");

        const page =
            pageParam && Number(pageParam) > 0 ? Number(pageParam) : 1;

        const perPage =
            perPageParam &&
            Number(perPageParam) > 0 &&
            Number(perPageParam) <= 50
                ? Number(perPageParam)
                : 10;

        const skip = (page - 1) * perPage;

        const where = {
            isActive: true,

            ...(search
                ? {
                    OR: [
                        {
                            name: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            sku: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            description: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            shortDescription: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                    ],
                }
                : {}),

            ...(category
                ? {
                    category: {
                        slug: category,
                    },
                }
                : {}),

            ...(size
                ? {
                    variants: {
                        some: {
                            value: size,
                            isActive: true,
                        },
                    },
                }
                : {}),

            ...(status
                ? {
                    status: status.toUpperCase().replaceAll("-", "_"),
                }
                : {}),

            ...((minPrice !== null || maxPrice !== null)
                ? {
                    price: {
                        ...(minPrice !== null
                            ? { gte: minPrice }
                            : {}),
                        ...(maxPrice !== null
                            ? { lte: maxPrice }
                            : {}),
                    },
                }
                : {}),
        };

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    images: {
                        orderBy: {
                            isPrimary: "desc",
                        },
                    },
                    variants: {
                        where: { isActive: true },
                    },
                    colors: true,
                    inventory: true,
                },
            }),
            prisma.product.count({ where }),
        ]);

        const totalPages = Math.ceil(total / perPage);
        const hasMore = page < totalPages;

        return Response.json({
            success: true,
            message: "Products loaded.",
            data: products.map(formatPaginatedProduct),
            meta: {
                current_page: page,
                per_page: perPage,
                total,
                total_pages: totalPages,
                has_more: hasMore,
            },
        });
    } catch (error) {
        const errorResponse = {
            success: false,
            message: "Failed to load products.",
            error: {
                code: error?.code ?? null,
                meta: error?.meta ?? null,
                details: error?.details ?? null,
                stack: process.env.NODE_ENV === "development" ? error?.stack ?? null : null,
            },
        };

        console.error("Product pagination API error:", error);

        return Response.json(errorResponse, { status: 500 });
    }
}