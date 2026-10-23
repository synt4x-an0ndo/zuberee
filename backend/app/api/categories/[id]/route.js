import prisma from "@/directory/prisma/prisma.js";
import { isStaffRole } from "@/lib/access.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_SIZE_GUIDE_TYPES = ["NONE", "SHOE", "DRESS"];

export async function GET(request, { params }) {
    try {

        const { id } = await params;
        const categoryId = Number(id);

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid category ID.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const category = await prisma.category.findUnique({
            where: {
                id: categoryId,
            },

            include: {
                parent: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },

                children: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        sizeGuideType: true,
                        displayPriority: true,
                        stockTracking: true,
                        showOnHomepage: true,
                    },

                    orderBy: {
                        displayPriority: "desc",
                    },
                },

                _count: {
                    select: {
                        products: true,
                        children: true,
                    },
                },
            },
        });

        if (!category) {
            return Response.json(
                {
                    success: false,
                    message: "Category not found.",
                    data: null,
                },
                { status: 404 }
            );
        }

        return Response.json(
            {
                success: true,
                message: "Category retrieved successfully.",
                data: category,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get category API error:", error);

        return Response.json(
            {
                success: false,
                message:
                    "Something went wrong while retrieving the category.",
                data: null,
            },
            { status: 500 }
        );
    }
}

export async function PUT(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        if (!isStaffRole(auth.user.role)) {
            return Response.json(
                {
                    success: false,
                    message: "Access denied. Admin privileges are required.",
                    data: null,
                },
                { status: 403 }
            );
        }

        const { id } = await params;
        const categoryId = Number(id);

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid category ID.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const existingCategory = await prisma.category.findUnique({
            where: {
                id: categoryId,
            },
        });

        if (!existingCategory) {
            return Response.json(
                {
                    success: false,
                    message: "Category not found.",
                    data: null,
                },
                { status: 404 }
            );
        }

        const body = await request.json();

        const {
            name,
            slug,
            description,
            sizeGuideType,
            parentId,
            displayPriority,
            stockTracking,
            showOnHomepage,
        } = body;

        // -----------------------------
        // Basic validation
        // -----------------------------

        if (!name || !slug) {
            return Response.json(
                {
                    success: false,
                    message: "Name and slug are required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (typeof name !== "string" || typeof slug !== "string") {
            return Response.json(
                {
                    success: false,
                    message: "Name and slug must be strings.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const normalizedName = name.trim();
        const normalizedSlug = slug.trim().toLowerCase();

        if (!normalizedName || !normalizedSlug) {
            return Response.json(
                {
                    success: false,
                    message: "Name and slug cannot be empty.",
                    data: null,
                },
                { status: 400 }
            );
        }

        // -----------------------------
        // Size guide validation
        // -----------------------------

        const normalizedSizeGuideType =
            sizeGuideType || existingCategory.sizeGuideType || "NONE";

        if (!VALID_SIZE_GUIDE_TYPES.includes(normalizedSizeGuideType)) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Invalid size guide type. Allowed values are NONE, SHOE, and DRESS.",
                    data: null,
                },
                { status: 400 }
            );
        }

        // -----------------------------
        // Display priority validation
        // -----------------------------

        const normalizedDisplayPriority =
            displayPriority === undefined || displayPriority === null
                ? existingCategory.displayPriority
                : Number(displayPriority);

        if (
            !Number.isInteger(normalizedDisplayPriority) ||
            normalizedDisplayPriority < 0 ||
            normalizedDisplayPriority > 999
        ) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Display priority must be an integer between 0 and 999.",
                    data: null,
                },
                { status: 400 }
            );
        }

        // -----------------------------
        // Boolean validation
        // -----------------------------

        if (
            stockTracking !== undefined &&
            typeof stockTracking !== "boolean"
        ) {
            return Response.json(
                {
                    success: false,
                    message: "stockTracking must be a boolean.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (
            showOnHomepage !== undefined &&
            typeof showOnHomepage !== "boolean"
        ) {
            return Response.json(
                {
                    success: false,
                    message: "showOnHomepage must be a boolean.",
                    data: null,
                },
                { status: 400 }
            );
        }

        // -----------------------------
        // Parent category validation
        // -----------------------------

        let normalizedParentId;

        if (parentId === null || parentId === "") {
            normalizedParentId = null;
        } else if (parentId === undefined) {
            normalizedParentId = existingCategory.parentId;
        } else {
            normalizedParentId = Number(parentId);

            if (
                !Number.isInteger(normalizedParentId) ||
                normalizedParentId <= 0
            ) {
                return Response.json(
                    {
                        success: false,
                        message: "Invalid parent category ID.",
                        data: null,
                    },
                    { status: 400 }
                );
            }

            // Category cannot be its own parent
            if (normalizedParentId === categoryId) {
                return Response.json(
                    {
                        success: false,
                        message: "A category cannot be its own parent.",
                        data: null,
                    },
                    { status: 400 }
                );
            }

            const parentCategory = await prisma.category.findUnique({
                where: {
                    id: normalizedParentId,
                },
            });

            if (!parentCategory) {
                return Response.json(
                    {
                        success: false,
                        message: "Parent category not found.",
                        data: null,
                    },
                    { status: 404 }
                );
            }
        }

        // -----------------------------
        // Duplicate validation
        // -----------------------------

        const duplicateCategory = await prisma.category.findFirst({
            where: {
                OR: [
                    {
                        name: normalizedName,
                    },
                    {
                        slug: normalizedSlug,
                    },
                ],
                NOT: {
                    id: categoryId,
                },
            },
        });

        if (duplicateCategory) {
            return Response.json(
                {
                    success: false,
                    message: "Category name or slug already exists.",
                    data: null,
                },
                { status: 409 }
            );
        }

        // -----------------------------
        // Update category
        // -----------------------------

        const category = await prisma.category.update({
            where: {
                id: categoryId,
            },

            data: {
                name: normalizedName,
                slug: normalizedSlug,
                description:
                    description === undefined
                        ? existingCategory.description
                        : description?.trim() || null,

                sizeGuideType: normalizedSizeGuideType,

                parentId: normalizedParentId,

                displayPriority: normalizedDisplayPriority,

                stockTracking:
                    stockTracking === undefined
                        ? existingCategory.stockTracking
                        : stockTracking,

                showOnHomepage:
                    showOnHomepage === undefined
                        ? existingCategory.showOnHomepage
                        : showOnHomepage,
            },

            include: {
                parent: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });

        return Response.json(
            {
                success: true,
                message: "Category updated successfully.",
                data: category,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update category API error:", error);

        return Response.json(
            {
                success: false,
                message:
                    "Something went wrong while updating the category.",
                data: null,
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        if (!isStaffRole(auth.user.role)) {
            return Response.json(
                {
                    success: false,
                    message: "Access denied. Admin privileges are required.",
                    data: null,
                },
                { status: 403 }
            );
        }

        const { id } = await params;
        const categoryId = Number(id);

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid category ID.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const category = await prisma.category.findUnique({
            where: {
                id: categoryId,
            },
        });

        if (!category) {
            return Response.json(
                {
                    success: false,
                    message: "Category not found.",
                    data: null,
                },
                { status: 404 }
            );
        }

        const hardDeleteParam = new URL(request.url).searchParams.get("hardDelete");
        const hardDeleteConfirmed =
            hardDeleteParam === "true" || hardDeleteParam === "1";
        const failureMessage =
            `Failed to delete '${category.name}'. ` +
            "Please try again or check whether this category is being used elsewhere.";

        // -----------------------------
        // Collect the category subtree before deciding whether it can be deleted.
        // Product.categoryId and Category.parentId are ON DELETE CASCADE in
        // the live database. Product-owned rows (images, variants, colors,
        // specifications, FAQs, inventory and cart items) also cascade, while
        // order_items.productId is ON DELETE RESTRICT. The transaction below
        // therefore re-checks every rule before deleting anything, so an
        // order-referenced product blocks the whole operation with no partial
        // deletion or orphaned product records.
        // -----------------------------

        const collectCategoryIds = async (
            currentCategoryId,
            accumulatedIds = [],
            client = prisma
        ) => {
            const childCategories = await client.category.findMany({
                where: {
                    parentId: currentCategoryId,
                },
                select: {
                    id: true,
                },
            });

            const nextIds = [...accumulatedIds, currentCategoryId];

            if (childCategories.length === 0) {
                return nextIds;
            }

            const nestedIds = await Promise.all(
                childCategories.map((child) =>
                    collectCategoryIds(child.id, nextIds, client)
                )
            );

            return [...new Set(nestedIds.flat())];
        };

        let deletion;

        try {
            deletion = await prisma.$transaction(async (tx) => {
                const categoryIdsToDelete = await collectCategoryIds(
                    categoryId,
                    [],
                    tx
                );
                const productCount = await tx.product.count({
                    where: {
                        categoryId: {
                            in: categoryIdsToDelete,
                        },
                    },
                });
                const subCategoryCount = categoryIdsToDelete.length - 1;

                // Root categories can never be hard-deleted while they contain
                // products or sub-categories, even if hardDelete=true is sent.
                if (
                    category.parentId === null &&
                    (productCount > 0 || subCategoryCount > 0)
                ) {
                    return {
                        outcome: "root_blocked",
                        productCount,
                        subCategoryCount,
                    };
                }

                // A sub-category containing products requires the explicit
                // hard-delete confirmation used by the admin popup.
                if (
                    category.parentId !== null &&
                    productCount > 0 &&
                    !hardDeleteConfirmed
                ) {
                    return {
                        outcome: "confirmation_required",
                        productCount,
                        subCategoryCount,
                    };
                }

                let orderItemCount = 0;

                if (productCount > 0) {
                    const productsToDelete = await tx.product.findMany({
                        where: {
                            categoryId: {
                                in: categoryIdsToDelete,
                            },
                        },
                        select: {
                            id: true,
                        },
                    });

                    orderItemCount = await tx.orderItem.count({
                        where: {
                            productId: {
                                in: productsToDelete.map((product) => product.id),
                            },
                        },
                    });
                }

                // Preserve order history exactly as the existing product-delete
                // endpoint does: order-referenced products cannot be removed.
                if (orderItemCount > 0) {
                    return {
                        outcome: "blocked_by_order_items",
                        productCount,
                        subCategoryCount,
                        orderItemCount,
                    };
                }

                const deletedProducts = await tx.product.deleteMany({
                    where: {
                        categoryId: {
                            in: categoryIdsToDelete,
                        },
                    },
                });

                const deletedCategories = await tx.category.deleteMany({
                    where: {
                        id: {
                            in: categoryIdsToDelete,
                        },
                    },
                });

                return {
                    outcome: "deleted",
                    productCount,
                    subCategoryCount,
                    orderItemCount,
                    deletedProductCount: deletedProducts.count,
                    deletedCategoryCount: deletedCategories.count,
                };
            });
        } catch (error) {
            console.error("Delete category transaction error:", error);

            return Response.json(
                {
                    success: false,
                    code: "CATEGORY_DELETE_FAILED",
                    message: failureMessage,
                    data: null,
                },
                { status: 500 }
            );
        }

        if (deletion.outcome === "root_blocked") {
            return Response.json(
                {
                    success: false,
                    code: "ROOT_CATEGORY_DELETE_BLOCKED",
                    message:
                        `You cannot delete '${category.name}' because it contains products and sub-categories. ` +
                        "Please move the products to another category and delete the sub-categories first, or change the category status to Inactive.",
                    data: null,
                },
                { status: 409 }
            );
        }

        if (deletion.outcome === "confirmation_required") {
            const productNoun =
                deletion.productCount === 1 ? "product" : "products";
            const nestedText =
                deletion.subCategoryCount > 0
                    ? `, its ${deletion.subCategoryCount} nested sub-categor${
                          deletion.subCategoryCount === 1 ? "y" : "ies"
                      },`
                    : "";

            return Response.json(
                {
                    success: false,
                    code: "HARD_DELETE_CONFIRMATION_REQUIRED",
                    message:
                        `Warning: This will permanently delete '${category.name}'${nestedText} and all ${deletion.productCount} ${productNoun} associated with it. ` +
                        "This action cannot be undone. Do you want to proceed?",
                    data: {
                        productCount: deletion.productCount,
                        subCategoryCount: deletion.subCategoryCount,
                        requiresHardDelete: true,
                    },
                },
                { status: 409 }
            );
        }

        if (deletion.outcome === "blocked_by_order_items") {
            return Response.json(
                {
                    success: false,
                    code: "CATEGORY_DELETE_FAILED",
                    message: failureMessage,
                    data: {
                        productCount: deletion.productCount,
                        subCategoryCount: deletion.subCategoryCount,
                        orderItemCount: deletion.orderItemCount,
                    },
                },
                { status: 409 }
            );
        }

        const successMessage =
            category.parentId === null
                ? "Category deleted successfully."
                : deletion.productCount > 0
                  ? `Sub-category '${category.name}' and its associated records have been deleted successfully.`
                  : `Sub-category '${category.name}' has been deleted successfully.`;

        return Response.json(
            {
                success: true,
                message: successMessage,
                data: null,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Delete category API error:", error);

        return Response.json(
            {
                success: false,
                message:
                    "Something went wrong while deleting the category.",
                data: null,
            },
            { status: 500 }
        );
    }
}