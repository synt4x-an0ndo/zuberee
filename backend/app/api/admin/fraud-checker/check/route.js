import prisma from "../../../../../directory/prisma/prisma.js";
import { authenticateRequest } from "@/directory/auth/auth.js";

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated || auth.user.role !== "ADMIN") {
            return Response.json(
                { success: false, message: "Admin access required." },
                { status: 403 }
            );
        }

        let body = {};

        try {
            body = await request.json();
        } catch {
            return Response.json(
                { success: false, message: "Request body is required." },
                { status: 400 }
            );
        }

        const { phone } = body;

        if (!phone || typeof phone !== "string" || !phone.trim()) {
            return Response.json(
                { success: false, message: "Phone is required." },
                { status: 400 }
            );
        }

        const settings = await prisma.fraudCheckerSettings.findFirst({
            orderBy: { createdAt: "asc" },
        });

        if (!settings || !settings.isActive) {
            return Response.json(
                {
                    success: false,
                    message: "Fraud checker is disabled.",
                },
                { status: 400 }
            );
        }

        if (!settings.apiKey) {
            return Response.json(
                {
                    success: false,
                    message: "Fraud checker API key is missing.",
                },
                { status: 400 }
            );
        }

        const url = `${settings.providerUrl}?phone=${encodeURIComponent(
            phone.trim()
        )}&api_key=${encodeURIComponent(settings.apiKey)}`;

        const response = await fetch(url);

        if (!response.ok) {
            return Response.json(
                {
                    success: false,
                    message: `Provider returned ${response.status}.`,
                },
                { status: 502 }
            );
        }

        const providerData = await response.json();

        return Response.json({
            success: true,
            data: providerData,
        });
    } catch (error) {
        console.error("Fraud check API error:", error);

        return Response.json(
            { success: false, message: "Failed to check fraud." },
            { status: 500 }
        );
    }
}