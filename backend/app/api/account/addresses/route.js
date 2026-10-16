import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

export async function POST(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const {
            fullName,
            full_name,
            phone,
            addressLine,
            address_line,
            city,
            postalCode,
            postal_code,
            country,
        } = body;

        const finalFullName = fullName ?? full_name;
        const finalAddressLine = addressLine ?? address_line;
        const finalPostalCode = postalCode ?? postal_code ?? null;
        const finalCountry = country ?? "Bangladesh";

        if (
            !finalFullName ||
            typeof finalFullName !== "string" ||
            !finalFullName.trim()
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Full name is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (!phone || typeof phone !== "string" || !phone.trim()) {
            return Response.json(
                {
                    success: false,
                    message: "Phone is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (
            !finalAddressLine ||
            typeof finalAddressLine !== "string" ||
            !finalAddressLine.trim()
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Address line is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (!city || typeof city !== "string" || !city.trim()) {
            return Response.json(
                {
                    success: false,
                    message: "City is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const address = await prisma.address.create({
            data: {
                userId: auth.user.userId,
                fullName: finalFullName.trim(),
                phone: phone.trim(),
                addressLine: finalAddressLine.trim(),
                city: city.trim(),
                postalCode: finalPostalCode
                    ? String(finalPostalCode).trim()
                    : null,
                country: String(finalCountry).trim(),
            },
        });

        return Response.json(
            {
                success: true,
                message: "Address added successfully.",
                data: {
                    id: address.id,
                    full_name: address.fullName,
                    phone: address.phone,
                    address_line: address.addressLine,
                    city: address.city,
                    postal_code: address.postalCode,
                    country: address.country,
                    created_at: address.createdAt,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Add address API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to add address.",
                data: null,
            },
            { status: 500 }
        );
    }
}

export async function GET(request) {
    try {
        const auth = await authenticateRequest(request);

        if (!auth.authenticated) {
            return Response.json(
                {
                    success: false,
                    message: auth.message,
                    data: null,
                },
                { status: 401 }
            );
        }

        const addresses = await prisma.address.findMany({
            where: { userId: auth.user.userId },
            orderBy: { createdAt: "desc" },
        });

        return Response.json(
            {
                success: true,
                message: "Addresses loaded.",
                data: addresses.map((addr) => ({
                    id: addr.id,
                    full_name: addr.fullName,
                    phone: addr.phone,
                    address_line: addr.addressLine,
                    city: addr.city,
                    postal_code: addr.postalCode,
                    country: addr.country,
                    created_at: addr.createdAt,
                })),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Get addresses API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to load addresses.",
                data: null,
            },
            { status: 500 }
        );
    }
}