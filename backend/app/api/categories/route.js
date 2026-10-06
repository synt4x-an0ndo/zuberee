import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { serializeAdminCategory } from "@/directory/categories/categories.js";

function slugify(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function validateParent(parentId) {
    if (parentId === null) return null;
    if (!Number.isInteger(parentId)) throw new Error("INVALID_PARENT");
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw new Error("PARENT_NOT_FOUND");
    return parentId;
}

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
        const parentId = await validateParent(body.parent_id ?? body.parentId ?? null);

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
                message: "Category created successfully.",
                data: serializeAdminCategory(category),
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

        const page = Math.max(1, Number(searchParams(request).page) || 1);
        const search = searchParams(request).search?.trim() || "";
        const pageSize = 20;
        const where = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {};
        const [categories, total] = await Promise.all([
            prisma.category.findMany({
                where,
                include: { parent: true },
                orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.category.count({ where }),
        ]);

        return Response.json(
            {
                success: true,
                message: "Categories retrieved successfully.",
                data: {
                    data: categories.map(serializeAdminCategory),
                    current_page: page,
                    last_page: Math.max(1, Math.ceil(total / pageSize)),
                    total,
                },
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

function searchParams(request) {
    return Object.fromEntries(new URL(request.url).searchParams.entries());
}