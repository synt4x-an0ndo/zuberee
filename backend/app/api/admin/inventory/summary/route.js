import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

const DEFAULT_LOW_STOCK_THRESHOLD = 3;

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { message: "failed", data: "Admin access required." },
                { status: 403 }
            );
        }

        const variants = await prisma.productVariant.findMany({
            select: {
                productId: true,
                stock: true,
                held: true,
                lowStockThreshold: true,
                trackInventory: true,
                price: true,
                product: {
                    select: {
                        price: true,
                        inventory: {
                            select: {
                                trackInventory: true,
                            },
                        },
                    },
                },
            },
        });

        let unitsOnHand = 0;
        let unitsReserved = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let stockValue = 0;
        const trackedProductIds = new Set();
        const totalVariants = variants.length;

        for (const v of variants) {
            const trackInv =
                v.trackInventory ||
                v.product?.inventory?.trackInventory ||
                false;

            const available = Math.max(0, v.stock - v.held);
            const threshold =
                v.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

            unitsOnHand += v.stock;
            unitsReserved += v.held;

            if (trackInv) {
                trackedProductIds.add(v.productId);

                if (available > 0 && available <= threshold) {
                    lowStock += 1;
                }

                if (available <= 0) {
                    outOfStock += 1;
                }
            }

            const priceValue =
                v.price !== null
                    ? Number(v.price)
                    : v.product?.price
                        ? Number(v.product.price)
                        : 0;

            stockValue += priceValue * v.stock;
        }

        return Response.json({
            message: "success",
            data: {
                tracked_products: trackedProductIds.size,
                total_variants: totalVariants,
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

        return Response.json(
            { message: "failed", data: null },
            { status: 500 }
        );
    }
}