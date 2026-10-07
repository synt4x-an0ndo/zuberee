import prisma from "@/directory/prisma/prisma.js";
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

        if (auth.user.role !== "ADMIN") {
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

        if (auth.user.role !== "ADMIN") {
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

        // -----------------------------
        // Check child categories
        // -----------------------------

        const childCount = await prisma.category.count({
            where: {
                parentId: categoryId,
            },
        });

        if (childCount > 0) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Category cannot be deleted because it has child categories.",
                    data: null,
                },
                { status: 409 }
            );
        }

        // -----------------------------
        // Check products
        // -----------------------------

        const productCount = await prisma.product.count({
            where: {
                categoryId,
            },
        });

        if (productCount > 0) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Category cannot be deleted because it has products.",
                    data: null,
                },
                { status: 409 }
            );
        }

        // -----------------------------
        // Delete category
        // -----------------------------

        await prisma.category.delete({
            where: {
                id: categoryId,
            },
        });

        return Response.json(
            {
                success: true,
                message: "Category deleted successfully.",
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