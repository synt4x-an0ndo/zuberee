import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import { deleteMediaFileByUrl, saveMediaFile } from "@/lib/media-store.js";

const ALLOWED_IMAGE_TYPES = new Map([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"],
    ["image/gif", ".gif"],
]);

export async function POST(request, { params }) {
    let savedImageUrl = null;

    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        const { id: productId } = await params;
        const id = Number(productId);

        if (!Number.isInteger(id) || id <= 0) {
            return Response.json(
                { success: false, message: "Invalid product ID." },
                { status: 400 }
            );
        }

        const product = await prisma.product.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!product) {
            return Response.json(
                { success: false, message: "Product not found." },
                { status: 404 }
            );
        }

        const formData = await request.formData();
        const image = formData.get("image");
        const extension = image && ALLOWED_IMAGE_TYPES.get(image.type);

        if (!image || typeof image === "string" || !extension) {
            return Response.json(
                {
                    success: false,
                    message: "A JPEG, PNG, WEBP, or GIF image file is required.",
                },
                { status: 400 }
            );
        }

        // Stored in Postgres so the running server serves it immediately.
        const stored = await saveMediaFile(image, "products");
        savedImageUrl = stored.url;

        const imageCount = await prisma.productImage.count({
            where: { productId: id },
        });
        const imageUrl = stored.url;
        const savedImage = await prisma.productImage.create({
            data: {
                productId: id,
                imageUrl,
                isPrimary: imageCount === 0,
            },
            select: {
                id: true,
                imageUrl: true,
                isPrimary: true,
            },
        });

        return Response.json(
            {
                success: true,
                message: "Product image uploaded successfully.",
                data: {
                    id: savedImage.id,
                    image: savedImage.imageUrl,
                    isPrimary: savedImage.isPrimary,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (savedImageUrl) {
            await deleteMediaFileByUrl(savedImageUrl);
        }
        console.error("Upload product image API error:", error);
        return Response.json(
            { success: false, message: "Failed to upload product image." },
            { status: 500 }
        );
    }
}