import prisma from "../../../directory/prisma/prisma.js";

const VALID_STATUSES = [
    "IN_STOCK",
    "OUT_OF_STOCK",
    "PRE_ORDER",
    "DISCONTINUED",
];

function formatProduct(product) {
    return {
        id: product.id,

        title: product.name,

        sku: product.sku,

        price: Number(product.price),

        discount:
            product.discount === null
                ? null
                : Number(product.discount),

        status: product.status
            .toLowerCase()
            .replace("_", "-"),

        short_description: product.shortDescription,

        description: product.description,

        video_url: product.videoUrl,

        images: product.images.map((image) => ({
            image: image.imageUrl,
        })),

        colors: product.colors.map((color) => ({
            id: color.id,
            name: color.name,
            code: color.code,
            image: color.image,
        })),

        sizes: product.variants.map((variant) => ({
            id: variant.id,
            size: variant.value,
            pivot: {
                price:
                    variant.price === null
                        ? Number(product.price)
                        : Number(variant.price),
                stock: variant.stock,
            },
        })),

        category: product.category
            ? [
                {
                    id: product.category.id,
                    name: product.category.name,
                    slug: product.category.slug,
                },
            ]
            : [],

        inventory: {
            track_inventory:
                product.inventory?.trackInventory ?? false,

            combinations: [],
        },

        product_colors: [],

        specifications: product.specifications.map(
            (specification) => ({
                key: specification.key,
                value: specification.value,
            })
        ),

        faqs: product.faqs.map((faq) => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer,
        })),
    };
}

// =====================================================
// GET ALL PRODUCTS
// GET /api/products
// =====================================================

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();

        const category = searchParams
            .get("category")
            ?.trim();

        const products = await prisma.product.findMany({
            where: {
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
                                description: {
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

                specifications: true,

                faqs: true,

                inventory: true,
            },
        });

        return Response.json({
            success: true,
            message: "Products loaded.",
            data: products.map(formatProduct),
        });
    } catch (error) {
        console.error("Get products API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load products.",
            },
            {
                status: 500,
            }
        );
    }
}

// =====================================================
// CREATE PRODUCT
// POST /api/products
// =====================================================

export async function POST(request) {
    try {
        const body = await request.json();

        const {
            title,
            name,
            sku,
            price,
            discount,
            status,
            short_description,
            shortDescription,
            description,
            video_url,
            videoUrl,
            category_id,
            categoryId,
            images = [],
            colors = [],
            sizes = [],
            inventory = {},
            specifications = [],
            faqs = [],
        } = body;

        const productName = title ?? name;

        const productCategoryId =
            category_id ?? categoryId;

        // ---------------------------------------------
        // Required validation
        // ---------------------------------------------

        if (
            !productName ||
            typeof productName !== "string" ||
            !productName.trim()
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Product title is required.",
                },
                { status: 400 }
            );
        }

        if (
            sku !== undefined &&
            sku !== null &&
            typeof sku !== "string"
        ) {
            return Response.json(
                {
                    success: false,
                    message: "SKU must be a string.",
                },
                { status: 400 }
            );
        }

        if (
            price === undefined ||
            price === null ||
            Number.isNaN(Number(price))
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Valid product price is required.",
                },
                { status: 400 }
            );
        }

        if (
            !productCategoryId ||
            !Number.isInteger(Number(productCategoryId))
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Valid categoryId is required.",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------
        // Status validation
        // ---------------------------------------------

        const productStatus = status
            ? String(status)
                .toUpperCase()
                .replace("-", "_")
            : "IN_STOCK";

        if (!VALID_STATUSES.includes(productStatus)) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid product status.",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------
        // Category validation
        // ---------------------------------------------

        const categoryRecord =
            await prisma.category.findUnique({
                where: {
                    id: Number(productCategoryId),
                },
            });

        if (!categoryRecord) {
            return Response.json(
                {
                    success: false,
                    message: "Category not found.",
                },
                { status: 404 }
            );
        }

        // ---------------------------------------------
        // SKU duplicate validation
        // ---------------------------------------------

        if (sku?.trim()) {
            const existingSku =
                await prisma.product.findUnique({
                    where: {
                        sku: sku.trim(),
                    },
                });

            if (existingSku) {
                return Response.json(
                    {
                        success: false,
                        message: "Product SKU already exists.",
                    },
                    { status: 409 }
                );
            }
        }

        // ---------------------------------------------
        // Create product
        // ---------------------------------------------

        const product = await prisma.product.create({
            data: {
                name: productName.trim(),

                sku: sku?.trim() || null,

                price: Number(price),

                discount:
                    discount === undefined ||
                    discount === null ||
                    discount === ""
                        ? null
                        : Number(discount),

                status: productStatus,

                shortDescription:
                    short_description ??
                    shortDescription ??
                    null,

                description: description ?? null,

                videoUrl:
                    video_url ??
                    videoUrl ??
                    null,

                stock: Number(body.stock ?? 0),

                isActive:
                    body.isActive !== undefined
                        ? Boolean(body.isActive)
                        : true,

                category: {
                    connect: {
                        id: Number(productCategoryId),
                    },
                },

                images: {
                    create: Array.isArray(images)
                        ? images.map((image, index) => ({
                            imageUrl:
                                typeof image === "string"
                                    ? image
                                    : image.image,

                            isPrimary:
                                typeof image === "object"
                                    ? Boolean(
                                        image.isPrimary
                                    )
                                    : index === 0,
                        }))
                        : [],
                },

                variants: {
                    create: Array.isArray(sizes)
                        ? sizes.map((size) => ({
                            name: "size",

                            value:
                                size.size ??
                                size.value ??
                                "",

                            price:
                                size.price === undefined ||
                                size.price === null ||
                                size.price === ""
                                    ? null
                                    : Number(size.price),

                            stock: Number(
                                size.stock ??
                                size.pivot?.stock ??
                                0
                            ),
                        }))
                        : [],
                },

                colors: {
                    create: Array.isArray(colors)
                        ? colors.map((color) => ({
                            name: color.name,
                            code: color.code,
                            image: color.image ?? null,
                        }))
                        : [],
                },

                specifications: {
                    create: Array.isArray(
                        specifications
                    )
                        ? specifications.map(
                            (specification) => ({
                                key: specification.key,
                                value: specification.value,
                            })
                        )
                        : [],
                },

                faqs: {
                    create: Array.isArray(faqs)
                        ? faqs.map((faq) => ({
                            question: faq.question,
                            answer: faq.answer,
                        }))
                        : [],
                },

                inventory: {
                    create: {
                        trackInventory: Boolean(
                            inventory.track_inventory ??
                            false
                        ),
                    },
                },
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

                specifications: true,

                faqs: true,

                inventory: true,
            },
        });

        return Response.json(
            {
                success: true,
                message: "Product created successfully.",
                data: formatProduct(product),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create product API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to create product.",
            },
            { status: 500 }
        );
    }
}