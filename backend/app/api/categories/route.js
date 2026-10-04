import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

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

        const existingCategory = await prisma.category.findFirst({
            where: {
                OR: [
                    { name: normalizedName },
                    { slug: normalizedSlug },
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

        const category = await prisma.category.create({
            data: {
                name: normalizedName,
                slug: normalizedSlug,
                description: description?.trim() || null,
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
                message: "Something went wrong while creating the category.",
                data: null,
            },
            { status: 500 }
        );
    }
}

export async function GET(request) {
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

        const categories = await prisma.category.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });

        return Response.json(
            {
                success: true,
                message: "Categories retrieved successfully.",
                data: categories,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get categories API error:", error);

        return Response.json(
            {
                success: false,
                message: "Something went wrong while retrieving categories.",
                data: null,
            },
            { status: 500 }
        );
    }
}