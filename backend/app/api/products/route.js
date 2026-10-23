import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { getPreorderRemaining, getProductOrderCapacity, getVariantOrderCapacity, isPreorderEligible, isProductPreorder, tracksStockPerSize } from "@/lib/preorder.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import {
    adjustProductStock,
    adjustVariantStock,
    inventoryError,
    isTransactionConflict,
    syncVariantProductStock,
} from "@/lib/inventory.js";

const VALID_STATUSES = [
    "IN_STOCK",
    "OUT_OF_STOCK",
    "PRE_ORDER",
    "SOLD_OUT",
];


function parseAllowPreorder(size, fallback = false) {
    const value = size?.allow_preorder ?? size?.allowPreorder ?? size?.pivot?.allow_preorder;
    return value === undefined ? fallback : Boolean(value);
}

function parsePreorderLimit(size, fallback = null) {
    const value = size?.preorder_limit ?? size?.preorderLimit ?? size?.pivot?.preorder_limit;
    if (value === undefined) return fallback;
    if (value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseStock(value, label = "Stock") {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw inventoryError(`${label} must be a whole number of 0 or more.`, 400);
    }
    return parsed;
}

function formatProduct(product) {
    const usesVariantStock = tracksStockPerSize(product);
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
            image: image.imageUrl,
        })),
        colors: product.colors.map((color) => ({
            id: color.id,
            name: color.name,
            code: color.code,
            image: color.image,
        })),
        sizes: product.variants.filter((variant) => variant.isActive !== false).map((variant) => ({
            id: variant.id,
            size: variant.value,
            pivot: {
                price:
                    variant.price === null
                        ? Number(product.price)
                        : Number(variant.price),
                stock: variant.stock,
                allow_preorder: usesVariantStock ? isPreorderEligible(product, variant) : isPreorderEligible(product),
                variant_allow_preorder: variant.allowPreorder,
                preorder_limit: variant.preorderLimit,
                preorder_count: variant.preorderCount,
                preorder_available: getPreorderRemaining(variant),
                order_capacity: usesVariantStock ? getVariantOrderCapacity(product, variant) : getProductOrderCapacity(product),
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
        specifications: product.specifications.map((specification) => ({
            key: specification.key,
            value: specification.value,
        })),
        faqs: product.faqs.map((faq) => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer,
        })),
    };
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search")?.trim();
        const category = searchParams.get("category")?.trim();
        const status = searchParams.get("status")?.trim();

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

                ...(status
                    ? {
                        status: status.toUpperCase().replaceAll("-", "_"),
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

        console.error("Get products API error:", error);

        return Response.json(errorResponse, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || !isStaffRole(auth.user.role)) {
            return Response.json(
                {
                    success: false,
                    message: "Admin access required.",
                },
                { status: 403 }
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
            images = [],
            colors = [],
            sizes = [],
            inventory = {},
            specifications = [],
            faqs = [],
        } = body;

        const productName = title ?? name;
        const productCategoryId = category_id ?? categoryId;

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

        const productStatus = status
            ? String(status).toUpperCase().replaceAll("-", "_")
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

        const categoryRecord = await prisma.category.findUnique({
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

        if (sku?.trim()) {
            const existingSku = await prisma.product.findUnique({
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

        const initialProductStock = parseStock(body.stock ?? 0);
        const tracksPerSize = Boolean(inventory.track_inventory ?? false);
        const product = await prisma.$transaction(async (tx) => {
            const created = await tx.product.create({
                data: {
                    name: productName.trim(),
                    sku: sku?.trim() || null,
                    price: Number(price),
                    discount: discount === undefined || discount === null || discount === "" ? null : Number(discount),
                    status: productStatus,
                    shortDescription: short_description ?? shortDescription ?? null,
                    description: description ?? null,
                    videoUrl: video_url ?? videoUrl ?? null,
                    // Per-size mode derives this after SKUs are created. Product-level
                    // mode keeps this as the authoritative quantity even with sizes.
                    stock: 0,
                    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
                    category: { connect: { id: Number(productCategoryId) } },
                    images: { create: Array.isArray(images) ? images.map((image, index) => ({ imageUrl: typeof image === "string" ? image : image.image, isPrimary: typeof image === "object" ? Boolean(image.isPrimary) : index === 0 })) : [] },
                    colors: { create: Array.isArray(colors) ? colors.map((color) => ({ name: color.name, code: color.code, image: color.image ?? null })) : [] },
                    specifications: { create: Array.isArray(specifications) ? specifications.map((specification) => ({ key: specification.key, value: specification.value })) : [] },
                    faqs: { create: Array.isArray(faqs) ? faqs.map((faq) => ({ question: faq.question, answer: faq.answer })) : [] },
                    inventory: { create: { trackInventory: tracksPerSize } },
                },
            });

            if (Array.isArray(sizes) && sizes.length > 0) {
                for (const [index, size] of sizes.entries()) {
                    const value = String(size.size ?? size.value ?? "");
                    const desiredStock = tracksPerSize
                        ? parseStock(size.stock ?? size.pivot?.stock ?? 0, `Stock for ${value || "variant"}`)
                        : 0;
                    const variant = await tx.productVariant.create({
                        data: {
                            productId: created.id,
                            name: "size",
                            value,
                            price: size.price === undefined || size.price === null || size.price === "" ? null : Number(size.price),
                            stock: 0,
                            held: 0,
                            reserved: 0,
                            allowPreorder: parseAllowPreorder(size),
                            preorderLimit: parsePreorderLimit(size),
                            position: index,
                            isActive: true,
                        },
                    });
                    if (desiredStock > 0) {
                        await adjustVariantStock(tx, {
                            variantId: variant.id,
                            delta: desiredStock,
                            type: "purchase",
                            note: "Opening stock from product creation",
                            userId: auth.user.userId,
                        });
                    }
                }
                if (tracksPerSize) await syncVariantProductStock(tx, [created.id]);
            }
            if ((!tracksPerSize || !Array.isArray(sizes) || sizes.length === 0) && initialProductStock > 0) {
                await adjustProductStock(tx, {
                    productId: created.id,
                    delta: initialProductStock,
                    type: "purchase",
                    note: "Opening stock from product creation",
                    userId: auth.user.userId,
                });
            }

            return tx.product.findUnique({
                where: { id: created.id },
                include: {
                    category: { select: { id: true, name: true, slug: true } },
                    images: { orderBy: { isPrimary: "desc" } },
                    variants: true,
                    colors: true,
                    specifications: true,
                    faqs: true,
                    inventory: true,
                },
            });
        }, { isolationLevel: "Serializable" });

        return Response.json(
            {
                success: true,
                message: "Product created successfully.",
                data: formatProduct(product),
            },
            { status: 201 }
        );
    } catch (error) {
        if (Number.isInteger(error?.status)) return Response.json({ success: false, message: error.message }, { status: error.status });
        if (isTransactionConflict(error)) return Response.json({ success: false, message: "Inventory changed while the product was being created. Try again." }, { status: 409 });
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