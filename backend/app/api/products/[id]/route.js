import prisma from "../../../../directory/prisma/prisma.js";

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

async function getProduct(id) {
    return prisma.product.findUnique({
        where: {
            id,
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
}

// =====================================================
// GET SINGLE PRODUCT
// GET /api/products/:id
// =====================================================

export async function GET(request, { params }) {
    try {
        const { id: productId } = await params;
        const id = Number(productId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid product ID.",
                },
                { status: 400 }
            );
        }

        const product = await getProduct(id);

        if (!product) {
            return Response.json(
                {
                    success: false,
                    message: "Product not found.",
                },
                { status: 404 }
            );
        }

        return Response.json({
            success: true,
            message: "Product loaded.",
            data: formatProduct(product),
        });
    } catch (error) {
        console.error(
            "Get product by ID API error:",
            error
        );

        return Response.json(
            {
                success: false,
                message: "Failed to load product.",
            },
            { status: 500 }
        );
    }
}

// =====================================================
// UPDATE PRODUCT
// PUT /api/products/:id
// =====================================================

export async function PUT(request, { params }) {
    try {
        const { id: productId } = await params;
        const id = Number(productId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid product ID.",
                },
                { status: 400 }
            );
        }

        const existingProduct = await prisma.product.findUnique(
            {
                where: { id },
            }
        );

        if (!existingProduct) {
            return Response.json(
                {
                    success: false,
                    message: "Product not found.",
                },
                { status: 404 }
            );
        }

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
            images,
            colors,
            sizes,
            inventory,
            specifications,
            faqs,
        } = body;

        const productName =
            title !== undefined
                ? title
                : name !== undefined
                    ? name
                    : existingProduct.name;

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

        // ---------------------------------------------
        // Category
        // ---------------------------------------------

        const newCategoryId =
            category_id ??
            categoryId ??
            existingProduct.categoryId;

        if (!Number.isInteger(Number(newCategoryId))) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid category ID.",
                },
                { status: 400 }
            );
        }

        const categoryRecord =
            await prisma.category.findUnique({
                where: {
                    id: Number(newCategoryId),
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

        const newSku =
            sku !== undefined
                ? sku?.trim() || null
                : existingProduct.sku;

        if (newSku) {
            const duplicateSku =
                await prisma.product.findFirst({
                    where: {
                        sku: newSku,
                        NOT: {
                            id,
                        },
                    },
                });

            if (duplicateSku) {
                return Response.json(
                    {
                        success: false,
                        message:
                            "Product SKU already exists.",
                    },
                    { status: 409 }
                );
            }
        }

        // ---------------------------------------------
        // Status
        // ---------------------------------------------

        const newStatus = status
            ? String(status)
                .toUpperCase()
                .replace("-", "_")
            : existingProduct.status;

        if (!VALID_STATUSES.includes(newStatus)) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid product status.",
                },
                { status: 400 }
            );
        }

        // ---------------------------------------------
        // Transaction
        // ---------------------------------------------

        const updatedProduct =
            await prisma.$transaction(async (tx) => {
                await tx.product.update({
                    where: { id },

                    data: {
                        name: productName.trim(),

                        sku: newSku,

                        price:
                            price !== undefined
                                ? Number(price)
                                : existingProduct.price,

                        discount:
                            discount !== undefined
                                ? discount === null ||
                                discount === ""
                                    ? null
                                    : Number(discount)
                                : existingProduct.discount,

                        status: newStatus,

                        shortDescription:
                            short_description ??
                            shortDescription ??
                            existingProduct.shortDescription,

                        description:
                            description !== undefined
                                ? description
                                : existingProduct.description,

                        videoUrl:
                            video_url ??
                            videoUrl ??
                            existingProduct.videoUrl,

                        categoryId: Number(
                            newCategoryId
                        ),

                        stock:
                            body.stock !== undefined
                                ? Number(body.stock)
                                : existingProduct.stock,

                        isActive:
                            body.isActive !== undefined
                                ? Boolean(body.isActive)
                                : existingProduct.isActive,
                    },
                });

                // -------------------------------------
                // Replace images if provided
                // -------------------------------------

                if (Array.isArray(images)) {
                    await tx.productImage.deleteMany({
                        where: { productId: id },
                    });

                    await tx.productImage.createMany({
                        data: images.map(
                            (image, index) => ({
                                productId: id,

                                imageUrl:
                                    typeof image ===
                                    "string"
                                        ? image
                                        : image.image,

                                isPrimary:
                                    typeof image ===
                                    "object"
                                        ? Boolean(
                                            image.isPrimary
                                        )
                                        : index === 0,
                            })
                        ),
                    });
                }

                // -------------------------------------
                // Replace sizes
                // -------------------------------------

                if (Array.isArray(sizes)) {
                    await tx.productVariant.deleteMany({
                        where: { productId: id },
                    });

                    if (sizes.length > 0) {
                        await tx.productVariant.createMany({
                            data: sizes.map(
                                (size) => ({
                                    productId: id,

                                    name: "size",

                                    value:
                                        size.size ??
                                        size.value ??
                                        "",

                                    price:
                                        size.price ===
                                        undefined ||
                                        size.price ===
                                        null ||
                                        size.price === ""
                                            ? null
                                            : Number(
                                                size.price
                                            ),

                                    stock: Number(
                                        size.stock ??
                                        size.pivot
                                            ?.stock ??
                                        0
                                    ),
                                })
                            ),
                        });
                    }
                }

                // -------------------------------------
                // Replace colors
                // -------------------------------------

                if (Array.isArray(colors)) {
                    await tx.productColor.deleteMany({
                        where: { productId: id },
                    });

                    if (colors.length > 0) {
                        await tx.productColor.createMany({
                            data: colors.map(
                                (color) => ({
                                    productId: id,
                                    name: color.name,
                                    code: color.code,
                                    image:
                                        color.image ??
                                        null,
                                })
                            ),
                        });
                    }
                }

                // -------------------------------------
                // Replace specifications
                // -------------------------------------

                if (
                    Array.isArray(
                        specifications
                    )
                ) {
                    await tx.productSpecification.deleteMany(
                        {
                            where: {
                                productId: id,
                            },
                        }
                    );

                    if (
                        specifications.length >
                        0
                    ) {
                        await tx.productSpecification.createMany(
                            {
                                data: specifications.map(
                                    (
                                        specification
                                    ) => ({
                                        productId: id,
                                        key:
                                        specification.key,
                                        value:
                                        specification.value,
                                    })
                                ),
                            }
                        );
                    }
                }

                // -------------------------------------
                // Replace FAQs
                // -------------------------------------

                if (Array.isArray(faqs)) {
                    await tx.productFaq.deleteMany({
                        where: {
                            productId: id,
                        },
                    });

                    if (faqs.length > 0) {
                        await tx.productFaq.createMany({
                            data: faqs.map(
                                (faq) => ({
                                    productId: id,
                                    question:
                                    faq.question,
                                    answer:
                                    faq.answer,
                                })
                            ),
                        });
                    }
                }

                // -------------------------------------
                // Inventory
                // -------------------------------------

                if (
                    inventory &&
                    typeof inventory ===
                    "object" &&
                    inventory.track_inventory !==
                    undefined
                ) {
                    await tx.productInventory.upsert({
                        where: {
                            productId: id,
                        },

                        create: {
                            productId: id,
                            trackInventory:
                                Boolean(
                                    inventory.track_inventory
                                ),
                        },

                        update: {
                            trackInventory:
                                Boolean(
                                    inventory.track_inventory
                                ),
                        },
                    });
                }

                return tx.product.findUnique({
                    where: { id },

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
            });

        return Response.json({
            success: true,
            message:
                "Product updated successfully.",
            data: formatProduct(updatedProduct),
        });
    } catch (error) {
        console.error(
            "Update product API error:",
            error
        );

        return Response.json(
            {
                success: false,
                message: "Failed to update product.",
            },
            { status: 500 }
        );
    }
}

// =====================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// =====================================================

export async function DELETE(request, { params }) {
    try {
        const { id: productId } = await params;
        const id = Number(productId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid product ID.",
                },
                { status: 400 }
            );
        }

        const product = await prisma.product.findUnique({
            where: { id },

            include: {
                _count: {
                    select: {
                        orderItems: true,
                    },
                },
            },
        });

        if (!product) {
            return Response.json(
                {
                    success: false,
                    message: "Product not found.",
                },
                { status: 404 }
            );
        }

        // ---------------------------------------------
        // Do not delete products already used in orders
        // ---------------------------------------------

        if (product._count.orderItems > 0) {
            return Response.json(
                {
                    success: false,
                    message:
                        "This product cannot be deleted because it is already used in an order.",
                },
                { status: 409 }
            );
        }

        await prisma.product.delete({
            where: { id },
        });

        return Response.json({
            success: true,
            message:
                "Product deleted successfully.",
        });
    } catch (error) {
        console.error(
            "Delete product API error:",
            error
        );

        return Response.json(
            {
                success: false,
                message: "Failed to delete product.",
            },
            { status: 500 }
        );
    }
}