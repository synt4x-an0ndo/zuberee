import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../../directory/auth/auth.js";

export async function PUT(request, { params }) {
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

        const { id } = await params;
        const addressId = Number(id);

        if (!Number.isInteger(addressId) || addressId <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid address ID.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const existing = await prisma.address.findFirst({
            where: {
                id: addressId,
                userId: auth.user.userId,
            },
        });

        if (!existing) {
            return Response.json(
                {
                    success: false,
                    message: "Address not found.",
                    data: null,
                },
                { status: 404 }
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

        const updateData = {};

        if (fullName !== undefined || full_name !== undefined) {
            const val = fullName ?? full_name;
            if (!val || !String(val).trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "Full name cannot be empty.",
                        data: null,
                    },
                    { status: 400 }
                );
            }
            updateData.fullName = String(val).trim();
        }

        if (phone !== undefined) {
            if (!phone || !String(phone).trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "Phone cannot be empty.",
                        data: null,
                    },
                    { status: 400 }
                );
            }
            updateData.phone = String(phone).trim();
        }

        if (addressLine !== undefined || address_line !== undefined) {
            const val = addressLine ?? address_line;
            if (!val || !String(val).trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "Address line cannot be empty.",
                        data: null,
                    },
                    { status: 400 }
                );
            }
            updateData.addressLine = String(val).trim();
        }

        if (city !== undefined) {
            if (!city || !String(city).trim()) {
                return Response.json(
                    {
                        success: false,
                        message: "City cannot be empty.",
                        data: null,
                    },
                    { status: 400 }
                );
            }
            updateData.city = String(city).trim();
        }

        if (postalCode !== undefined || postal_code !== undefined) {
            const val = postalCode ?? postal_code;
            updateData.postalCode =
                val === null || String(val).trim() === ""
                    ? null
                    : String(val).trim();
        }

        if (country !== undefined) {
            updateData.country = String(country).trim() || "Bangladesh";
        }

        if (Object.keys(updateData).length === 0) {
            return Response.json(
                {
                    success: false,
                    message: "No valid fields to update.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const updated = await prisma.address.update({
            where: { id: addressId },
            data: updateData,
        });

        return Response.json(
            {
                success: true,
                message: "Address updated successfully.",
                data: {
                    id: updated.id,
                    full_name: updated.fullName,
                    phone: updated.phone,
                    address_line: updated.addressLine,
                    city: updated.city,
                    postal_code: updated.postalCode,
                    country: updated.country,
                    created_at: updated.createdAt,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Update address API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to update address.",
                data: null,
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
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

        const { id } = await params;
        const addressId = Number(id);

        if (!Number.isInteger(addressId) || addressId <= 0) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid address ID.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const existing = await prisma.address.findFirst({
            where: {
                id: addressId,
                userId: auth.user.userId,
            },
        });

        if (!existing) {
            return Response.json(
                {
                    success: false,
                    message: "Address not found.",
                    data: null,
                },
                { status: 404 }
            );
        }

        await prisma.address.delete({ where: { id: addressId } });

        return Response.json(
            {
                success: true,
                message: "Address deleted successfully.",
                data: null,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Delete address API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to delete address.",
                data: null,
            },
            { status: 500 }
        );
    }
}