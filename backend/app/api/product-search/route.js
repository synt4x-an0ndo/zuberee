import prisma from "@/directory/prisma/prisma.js";
import { getPreorderRemaining, getProductOrderCapacity, getVariantOrderCapacity, isPreorderEligible, isProductPreorder } from "@/lib/preorder.js";

function formatSearchProduct(product) {
    return {
        id: product.id,
        title: product.name,
        sku: product.sku,
        price: Number(product.price),
        discount:
            product.discount === null ? null : Number(product.discount),
        status: product.status.toLowerCase().replaceAll("_", "-"),
        stock: product.stock,
        allow_preorder: isProductPreorder(product),
        order_capacity: getProductOrderCapacity(product),
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
                allow_preorder: isPreorderEligible(product, variant),
                variant_allow_preorder: variant.allowPreorder,
                preorder_limit: variant.preorderLimit,
                preorder_count: variant.preorderCount,
                preorder_available: getPreorderRemaining(variant),
                order_capacity: getVariantOrderCapacity(product, variant),
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

        const q = searchParams.get("q")?.trim();
        const category = searchParams.get("category")?.trim();
        const minPrice = toFiniteNumber(searchParams.get("min_price"));
        const maxPrice = toFiniteNumber(searchParams.get("max_price"));

        const products = await prisma.product.findMany({
            where: {
                isActive: true,

                ...(q
                    ? {
                        OR: [
                            {
                                name: {
                                    contains: q,
                                    mode: "insensitive",
                                },
                            },
                            {
                                sku: {
                                    contains: q,
                                    mode: "insensitive",
                                },
                            },
                            {
                                description: {
                                    contains: q,
                                    mode: "insensitive",
                                },
                            },
                            {
                                shortDescription: {
                                    contains: q,
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
            },

            orderBy: {
                createdAt: "desc",
            },

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
                variants: true,
                colors: true,
                inventory: true,
            },
        });

        return Response.json({
            success: true,
            message: "Products loaded.",
            data: products.map(formatSearchProduct),
        });
    } catch (error) {
        console.error("Product search API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to search products.",
            },
            { status: 500 }
        );
    }
}