import prisma from "@/directory/prisma/prisma.js";

export async function GET(request) {
    try {
        const sizes = await prisma.size.findMany({
            where: { isActive: true },
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: { id: true, size: true },
        });

        return Response.json(sizes);
    } catch (error) {
        console.error("Get sizes API error:", error);

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}