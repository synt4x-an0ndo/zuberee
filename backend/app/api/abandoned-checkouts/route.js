import prisma from "@/directory/prisma/prisma.js";

export async function POST(request) {
    try {
        const body = await request.json();

        const {
            sessionId,
            userId,
            cartItems,
            name,
            phone,
            address,
        } = body;

        if (!sessionId || !Array.isArray(cartItems) || cartItems.length === 0) {
            return Response.json(
                { success: false, message: "sessionId and cartItems required." },
                { status: 400 }
            );
        }

        const existing = await prisma.abandonedCheckout.findUnique({
            where: { sessionId },
        });

        let record;

        if (existing) {
            record = await prisma.abandonedCheckout.update({
                where: { sessionId },
                data: {
                    userId: userId ?? existing.userId,
                    cartItems,
                    name: name ?? existing.name,
                    phone: phone ?? existing.phone,
                    address: address ?? existing.address,
                },
            });
        } else {
            record = await prisma.abandonedCheckout.create({
                data: {
                    sessionId,
                    userId: userId ?? null,
                    cartItems,
                    name: name ?? null,
                    phone: phone ?? null,
                    address: address ?? null,
                    status: "pending",
                },
            });
        }

        return Response.json(
            {
                success: true,
                message: "Abandoned checkout saved.",
                data: record,
            },
            { status: existing ? 200 : 201 }
        );
    } catch (error) {
        console.error("Save abandoned checkout API error:", error);

        return Response.json(
            { success: false, message: "Failed to save abandoned checkout." },
            { status: 500 }
        );
    }
}