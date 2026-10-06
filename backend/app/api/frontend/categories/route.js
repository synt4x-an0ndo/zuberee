import prisma from "@/directory/prisma/prisma.js";
import { buildCategoryTree } from "@/directory/categories/categories.js";

export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: [{ priority: "desc" }, { name: "asc" }],
        });

        return Response.json({
            success: true,
            message: "Categories loaded.",
            data: buildCategoryTree(categories),
        });
    } catch (error) {
        console.error("Load frontend categories API error:", error);
        return Response.json(
            {
                success: false,
                message: "Something went wrong while loading categories.",
                data: null,
            },
            { status: 500 }
        );
    }
}