import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { deleteMediaFileByUrl } from "@/lib/media-store.js";
import { getPreorderRemaining, getProductOrderCapacity, getVariantOrderCapacity, isPreorderEligible, isProductPreorder, tracksStockPerSize } from "@/lib/preorder.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import {
    adjustProductStock,
    adjustVariantStock,
    inventoryError,
    isTransactionConflict,
    lockProductFamilies,
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
            product.discount === null
                ? null
                : Number(product.discount),
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
}

// =====================================================
// GET SINGLE PRODUCT (PUBLIC)
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
        console.error("Get product by ID API error:", error);

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
// UPDATE PRODUCT (ADMIN ONLY)
// PUT /api/products/:id
// =====================================================

export async function PUT(request, { params }) {
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

        const existingProduct = await prisma.product.findUnique({
            where: { id },
        });

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

        const categoryRecord = await prisma.category.findUnique({
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

        const newSku =
            sku !== undefined
                ? sku?.trim() || null
                : existingProduct.sku;

        if (newSku) {
            const duplicateSku = await prisma.product.findFirst({
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
                        message: "Product SKU already exists.",
                    },
                    { status: 409 }
                );
            }
        }

        const newStatus = status
            ? String(status)
                .toUpperCase()
                .replaceAll("-", "_")
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

        const updatedProduct = await prisma.$transaction(async (tx) => {
                await lockProductFamilies(tx, [id]);
                const lockedProduct = await tx.product.findUnique({
                    where: { id },
                    include: { variants: true, inventory: true },
                });
                if (!lockedProduct) throw inventoryError("Product not found.", 404);
                const tracksPerSize = inventory && typeof inventory === "object" && inventory.track_inventory !== undefined
                    ? Boolean(inventory.track_inventory)
                    : Boolean(lockedProduct.inventory?.trackInventory ?? false);

                // Persist the mode before any stock helper runs so direct-product
                // adjustments are allowed in product-level mode.
                if (inventory && typeof inventory === "object" && inventory.track_inventory !== undefined) {
                    await tx.productInventory.upsert({
                        where: { productId: id },
                        create: { productId: id, trackInventory: tracksPerSize },
                        update: { trackInventory: tracksPerSize },
                    });
                }

                await tx.product.update({
                    where: { id },
                    data: {
                        name: productName.trim(),
                        sku: newSku,
                        price: price !== undefined ? Number(price) : lockedProduct.price,
                        discount: discount !== undefined
                            ? discount === null || discount === "" ? null : Number(discount)
                            : lockedProduct.discount,
                        status: newStatus,
                        shortDescription: short_description ?? shortDescription ?? lockedProduct.shortDescription,
                        description: description !== undefined ? description : lockedProduct.description,
                        videoUrl: video_url ?? videoUrl ?? lockedProduct.videoUrl,
                        categoryId: Number(newCategoryId),
                        isActive: body.isActive !== undefined ? Boolean(body.isActive) : lockedProduct.isActive,
                    },
                });

                if (Array.isArray(images)) {
                    await tx.productImage.deleteMany({ where: { productId: id } });
                    await tx.productImage.createMany({
                        data: images.map((image, index) => ({
                            productId: id,
                            imageUrl: typeof image === "string" ? image : image.image,
                            isPrimary: typeof image === "object" ? Boolean(image.isPrimary) : index === 0,
                        })),
                    });
                }

                if (Array.isArray(sizes)) {
                    const existingVariants = await tx.productVariant.findMany({ where: { productId: id }, orderBy: { id: "asc" } });
                    const usedVariantIds = new Set();
                    for (const [index, size] of sizes.entries()) {
                        const value = String(size.size ?? size.value ?? "");
                        const requestedId = Number(size.id ?? size.variantId ?? size.variant_id);
                        const matched = existingVariants.find((variant) => (
                            !usedVariantIds.has(variant.id)
                            && (Number.isInteger(requestedId) && requestedId > 0 ? variant.id === requestedId : variant.value === value)
                        ));
                        const desiredStock = tracksPerSize
                            ? parseStock(size.stock ?? size.pivot?.stock ?? matched?.stock ?? 0, `Stock for ${value || "variant"}`)
                            : matched?.stock ?? 0;
                        const data = {
                            name: "size",
                            value,
                            price: size.price === undefined || size.price === null || size.price === "" ? null : Number(size.price),
                            position: index,
                            isActive: true,
                            ...(tracksPerSize ? {
                                allowPreorder: parseAllowPreorder(size, matched?.allowPreorder ?? false),
                                preorderLimit: parsePreorderLimit(size, matched?.preorderLimit ?? null),
                            } : {}),
                        };
                        if (matched) {
                            usedVariantIds.add(matched.id);
                            await tx.productVariant.update({ where: { id: matched.id }, data });
                            if (tracksPerSize && desiredStock !== matched.stock) {
                                await adjustVariantStock(tx, {
                                    variantId: matched.id,
                                    delta: desiredStock - matched.stock,
                                    type: "adjustment",
                                    note: "Stock adjusted from product editor",
                                    userId: auth.user.userId,
                                });
                            }
                        } else {
                            const created = await tx.productVariant.create({ data: { productId: id, ...data, stock: 0, held: 0, reserved: 0 } });
                            if (tracksPerSize && desiredStock > 0) {
                                await adjustVariantStock(tx, {
                                    variantId: created.id,
                                    delta: desiredStock,
                                    type: "purchase",
                                    note: "Opening stock from product editor",
                                    userId: auth.user.userId,
                                });
                            }
                        }
                    }
                    const removedVariantIds = existingVariants.filter((variant) => !usedVariantIds.has(variant.id)).map((variant) => variant.id);
                    // Never delete a SKU that could be referenced by an order or
                    // ledger entry. It remains historically intact but cannot be sold.
                    if (removedVariantIds.length > 0) {
                        await tx.productVariant.updateMany({ where: { id: { in: removedVariantIds } }, data: { isActive: false } });
                    }
                    if (tracksPerSize) await syncVariantProductStock(tx, [id]);
                }
                if (body.stock !== undefined && (!Array.isArray(sizes) || !tracksPerSize)) {
                    const desiredStock = parseStock(body.stock);
                    if (tracksPerSize && lockedProduct.variants.length > 0) {
                        if (desiredStock !== lockedProduct.stock) {
                            throw inventoryError("Set stock per variant; product stock is derived from its variants.", 400);
                        }
                    } else if (desiredStock !== lockedProduct.stock) {
                        await adjustProductStock(tx, {
                            productId: id,
                            delta: desiredStock - lockedProduct.stock,
                            type: "adjustment",
                            note: "Stock adjusted from product editor",
                            userId: auth.user.userId,
                        });
                    }
                }

                if (Array.isArray(colors)) {
                    await tx.productColor.deleteMany({ where: { productId: id } });
                    if (colors.length > 0) await tx.productColor.createMany({ data: colors.map((color) => ({ productId: id, name: color.name, code: color.code, image: color.image ?? null })) });
                }
                if (Array.isArray(specifications)) {
                    await tx.productSpecification.deleteMany({ where: { productId: id } });
                    if (specifications.length > 0) await tx.productSpecification.createMany({ data: specifications.map((specification) => ({ productId: id, key: specification.key, value: specification.value })) });
                }
                if (Array.isArray(faqs)) {
                    await tx.productFaq.deleteMany({ where: { productId: id } });
                    if (faqs.length > 0) await tx.productFaq.createMany({ data: faqs.map((faq) => ({ productId: id, question: faq.question, answer: faq.answer })) });
                }
                return tx.product.findUnique({
                    where: { id },
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

        return Response.json({
            success: true,
            message: "Product updated successfully.",
            data: formatProduct(updatedProduct),
        });
    } catch (error) {
        if (Number.isInteger(error?.status)) {
            return Response.json({ success: false, message: error.message }, { status: error.status });
        }
        if (isTransactionConflict(error)) {
            return Response.json({ success: false, message: "Inventory changed while the product was being saved. Reload and try again." }, { status: 409 });
        }
        console.error("Update product API error:", error);

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
// DELETE PRODUCT (ADMIN ONLY)
// DELETE /api/products/:id
// =====================================================

export async function DELETE(request, { params }) {
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

        const productImages = await prisma.productImage.findMany({
            where: { productId: id },
            select: { imageUrl: true },
        });

        await prisma.product.delete({
            where: { id },
        });

        // The product rows are gone, so drop the matching media assets too;
        // otherwise the table keeps growing with unreachable images.
        await Promise.all(
            productImages.map((image) => deleteMediaFileByUrl(image.imageUrl))
        );

        return Response.json({
            success: true,
            message: "Product deleted successfully.",
        });
    } catch (error) {
        console.error("Delete product API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to delete product.",
            },
            { status: 500 }
        );
    }
}