import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";
import {
    adjustProductStock,
    adjustVariantStock,
    inventoryError,
    isTransactionConflict,
    lockProductFamilies,
    syncVariantProductStock,
} from "@/lib/inventory.js";

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json({ message: "Admin access required." }, { status: 403 });
        }

        const body = await request.json();
        const variantId = Number(body.product_variant_id ?? body.productVariantId);
        const productId = Number(body.product_id ?? body.productId);
        const qty = Number(body.quantity);
        const cleanNote = typeof body.note === "string" && body.note.trim() ? body.note.trim() : "Stock received";
        if (!Number.isInteger(qty) || qty <= 0 || (Number.isInteger(variantId) && variantId > 0) === (Number.isInteger(productId) && productId > 0)) {
            return Response.json({ message: "Choose one product or variant and a whole quantity greater than zero." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            if (Number.isInteger(productId) && productId > 0) {
                await lockProductFamilies(tx, [productId]);
                const updatedProduct = await adjustProductStock(tx, {
                    productId,
                    delta: qty,
                    type: "purchase",
                    note: cleanNote,
                    userId: auth.user.userId,
                });
                return { ...updatedProduct, productId: updatedProduct.id, isProductLevel: true };
            }

            const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } });
            if (!variant) throw inventoryError("Variant not found.", 404);
            await lockProductFamilies(tx, [variant.productId]);
            const updatedVariant = await adjustVariantStock(tx, {
                variantId,
                delta: qty,
                type: "purchase",
                note: cleanNote,
                userId: auth.user.userId,
            });
            await syncVariantProductStock(tx, [updatedVariant.productId]);
            return { ...updatedVariant, isProductLevel: false };
        }, { isolationLevel: "Serializable" });

        return Response.json({ message: "success", data: { stock_after: result.stock, product_id: result.productId, product_level: result.isProductLevel } });
    } catch (error) {
        if (Number.isInteger(error?.status)) return Response.json({ message: error.message }, { status: error.status });
        if (isTransactionConflict(error)) return Response.json({ message: "Stock changed while receiving inventory. Please try again." }, { status: 409 });
        if (error instanceof SyntaxError) return Response.json({ message: "Invalid JSON body." }, { status: 400 });
        console.error("Receive stock API error:", error);
        return Response.json({ message: "Failed to receive stock." }, { status: 500 });
    }
}
