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
        const qty = Number(quantity);

        if (!product_variant_id || !Number.isInteger(qty) || qty <= 0) {
            return Response.json({ message: "Invalid variant or quantity." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const variant = await tx.productVariant.findUnique({
                where: { id: Number(product_variant_id) }
            });

            if (!variant) throw new Error("Variant not found");

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
                    note: note || "Stock received",
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
        console.error("Receive stock API error:", error);
        return Response.json({ message: "Failed to receive stock." }, { status: 500 });
    }
}