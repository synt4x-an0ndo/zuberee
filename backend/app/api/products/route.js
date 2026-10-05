import prisma from "../../../directory/prisma/prisma.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category")?.trim();

    const products = await prisma.product.findMany({
        where: {
            isActive: true,
            ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
            ...(category ? { category: { slug: category } } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
            category: true,
            images: { orderBy: { isPrimary: "desc" } },
            variants: true,
        },
    });

    return Response.json({
        success: true,
        message: "Products loaded.",
        data: products.map((product) => ({
            ...product,
            price: Number(product.price),
            variants: product.variants.map((variant) => ({
                ...variant,
                price: variant.price === null ? null : Number(variant.price),
            })),
        })),
    });
}
