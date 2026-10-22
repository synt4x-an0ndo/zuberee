import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json({ message: "failed", data: "Admin access required." }, { status: 403 });
        }

        const products = await prisma.product.findMany({
            select: {
                id: true,
                stock: true,
                price: true,
                inventory: { select: { trackInventory: true } },
                variants: { select: { stock: true, held: true, lowStockThreshold: true, price: true } },
            },
        });

        let unitsOnHand = 0;
        let unitsReserved = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let stockValue = 0;
        let totalRows = 0;
        let trackedProducts = 0;

        for (const product of products) {
            const tracksPerSize = Boolean(product.inventory?.trackInventory);
            if (tracksPerSize) trackedProducts += 1;
            const rows = tracksPerSize && product.variants.length > 0
                ? product.variants.map((variant) => ({
                    stock: variant.stock,
                    held: variant.held,
                    threshold: variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
                    price: variant.price === null ? Number(product.price) : Number(variant.price),
                }))
                : [{
                    stock: product.stock,
                    held: 0,
                    threshold: DEFAULT_LOW_STOCK_THRESHOLD,
                    price: Number(product.price),
                }];

            totalRows += rows.length;
            for (const row of rows) {
                const available = Math.max(0, row.stock - row.held);
                unitsOnHand += row.stock;
                unitsReserved += row.held;
                if (available > 0 && available <= row.threshold) lowStock += 1;
                if (available <= 0) outOfStock += 1;
                stockValue += row.price * row.stock;
            }
        }

        return Response.json({
            message: "success",
            data: {
                tracked_products: trackedProducts,
                total_variants: totalRows,
                units_on_hand: unitsOnHand,
                units_reserved: unitsReserved,
                low_stock: lowStock,
                out_of_stock: outOfStock,
                stock_value: stockValue,
                low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
            },
        });
    } catch (error) {
        console.error("Inventory summary API error:", error);
        return Response.json({ message: "failed", data: null }, { status: 500 });
    }
}
