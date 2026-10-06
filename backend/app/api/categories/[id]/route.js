import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

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

        const { name, slug, description } = body;

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

        const normalizedName = name.trim();
        const normalizedSlug = slug.trim().toLowerCase();

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