import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

const VALID_SIZE_GUIDE_TYPES = ["NONE", "SHOE", "DRESS"];

export async function POST(request) {
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

        const normalizedSizeGuideType = sizeGuideType || "NONE";

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
                ? 0
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

        let normalizedParentId = null;

        if (
            parentId !== undefined &&
            parentId !== null &&
            parentId !== ""
        ) {
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

        const existingCategory = await prisma.category.findFirst({
            where: {
                OR: [
                    {
                        name: normalizedName,
                    },
                    {
                        slug: normalizedSlug,
                    },
                ],
            },
        });

        if (existingCategory) {
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
        // Create category
        // -----------------------------

        const category = await prisma.category.create({
            data: {
                name: normalizedName,
                slug: normalizedSlug,
                description: description?.trim() || null,
                sizeGuideType: normalizedSizeGuideType,
                parentId: normalizedParentId,
                displayPriority: normalizedDisplayPriority,
                stockTracking: stockTracking ?? false,
                showOnHomepage: showOnHomepage ?? false,
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
                message: "Category created successfully.",
                data: category,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create category API error:", error);

        return Response.json(
            {
                success: false,
                message:
                    "Something went wrong while creating the category.",
                data: null,
            },
            { status: 500 }
        );
    }
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        const [categories, totalCategories, rootCategories] =
            await prisma.$transaction([
                prisma.category.findMany({
                    orderBy: [
                        {
                            displayPriority: "desc",
                        },
                        {
                            createdAt: "desc",
                        },
                    ],
                    include: {
                        parent: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                        _count: {
                            select: {
                                children: true,
                                products: true,
                            },
                        },
                    },
                }),

                prisma.category.count(),

                prisma.category.count({
                    where: {
                        parentId: null,
                    },
                }),
            ]);

        return Response.json(
            {
                success: true,
                message: "Categories retrieved successfully.",
                data: {
                    categories,
                    totalCategories,
                    rootCategories,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get categories API error:", error);

        return Response.json(
            {
                success: false,
                message:
                    "Something went wrong while retrieving categories.",
                data: null,
            },
            { status: 500 }
        );
    }
}