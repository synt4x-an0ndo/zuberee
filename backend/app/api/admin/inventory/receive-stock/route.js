import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json({ message: "Admin access required." }, { status: 403 });
        }

        const body = await request.json();
        const { product_variant_id, quantity, note } = body;
        const variantId = Number(product_variant_id);
        const qty = Number(quantity);
        const cleanNote = typeof note === "string" && note.trim() ? note.trim() : "Stock received";

        if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(qty) || qty <= 0) {
            return Response.json({ message: "Invalid variant or quantity." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const variant = await tx.productVariant.findUnique({
                where: { id: variantId }
            });

            if (!variant) {
                const notFound = new Error("Variant not found.");
                notFound.code = "VARIANT_NOT_FOUND";
                throw notFound;
            }

            const updatedVariant = await tx.productVariant.update({
                where: { id: variant.id },
                data: { stock: { increment: qty } }
            });

            await tx.stockMovement.create({
                data: {
                    productVariantId: variant.id,
                    type: "purchase",
                    quantity: qty,
                    stockAfter: updatedVariant.stock,
                    reservedAfter: updatedVariant.held,
                    note: cleanNote,
                    userId: auth.user.userId
                }
            });

            return updatedVariant;
        });

        return Response.json({
            message: "success",
            data: { stock_after: result.stock }
        });
    } catch (error) {
        if (error?.code === "VARIANT_NOT_FOUND" || error?.code === "P2025") {
            return Response.json({ message: "Variant not found." }, { status: 404 });
        }
        if (error instanceof SyntaxError) {
            return Response.json({ message: "Invalid JSON body." }, { status: 400 });
        }
        console.error("Receive stock API error:", error);
        return Response.json({ message: "Failed to receive stock." }, { status: 500 });
    }
}