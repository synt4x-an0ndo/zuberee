import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { serializeAdminCategory } from "@/directory/categories/categories.js";

function slugify(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function parentIdFromBody(body, categoryId) {
    const rawParentId = body.parent_id ?? body.parentId ?? null;
    if (rawParentId === null || rawParentId === "") return null;
    const parentId = Number(rawParentId);
    if (!Number.isInteger(parentId) || parentId === categoryId) throw new Error("INVALID_PARENT");
    if (!(await prisma.category.findUnique({ where: { id: parentId } }))) throw new Error("PARENT_NOT_FOUND");
    return parentId;
}

export async function GET(request, { params }) {
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

        const { id } = await params;
        const categoryId = Number(id);

        if (!Number.isInteger(categoryId)) {
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
            include: { parent: true },
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
                data: serializeAdminCategory(category),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get category API error:", error);

        return Response.json(
            {
                success: false,
                message: "Something went wrong while retrieving the category.",
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

        if (!Number.isInteger(categoryId)) {
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

        const { name, description } = body;

        if (!name) {
            return Response.json(
                {
                    success: false,
                    message: "Name is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const normalizedName = name.trim();
        const normalizedSlug = slugify(body.slug || normalizedName);
        const parentId = await parentIdFromBody(body, categoryId);

        const duplicateCategory = await prisma.category.findFirst({
            where: {
                OR: [
                    { name: normalizedName },
                    { slug: normalizedSlug },
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

        const category = await prisma.category.update({
            where: {
                id: categoryId,
            },
            data: {
                name: normalizedName,
                slug: normalizedSlug,
                description: description?.trim() || null,
                parentId,
                homeCategory: body.home_category === true || body.home_category === "1" || body.homeCategory === true,
                priority: Number.isInteger(Number(body.priority)) ? Number(body.priority) : 0,
                sizeGuideType: body.size_guide_type || body.sizeGuideType || null,
                trackInventory: body.track_inventory === true || body.track_inventory === "1" || body.trackInventory === true,
            },
        });

        return Response.json(
            {
                success: true,
                message: "Category updated successfully.",
                data: serializeAdminCategory(category),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update category API error:", error);

        return Response.json(
            {
                success: false,
                message: "Something went wrong while updating the category.",
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

        if (!Number.isInteger(categoryId)) {
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

        const productCount = await prisma.product.count({
            where: {
                categoryId,
            },
        });

        if (productCount > 0) {
            return Response.json(
                {
                    success: false,
                    message: "Category cannot be deleted because it has products.",
                    data: null,
                },
                { status: 409 }
            );
        }

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
                message: "Something went wrong while deleting the category.",
                data: null,
            },
            { status: 500 }
        );
    }
}