import bcrypt from "bcryptjs";
import prisma from "@/directory/prisma/prisma.js";
import { authenticateRequest } from "../../../../directory/auth/auth.js";

export async function PUT(request) {
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

        // Spec request fields: currentPassword, newPassword, confirmPassword.
        const { currentPassword, newPassword, confirmPassword } = body;

        const finalCurrent = currentPassword;
        const finalNew = newPassword;
        const finalConfirm = confirmPassword;

        if (
            !finalCurrent ||
            typeof finalCurrent !== "string" ||
            !finalCurrent.trim()
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Current password is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (
            !finalNew ||
            typeof finalNew !== "string" ||
            finalNew.length < 6
        ) {
            return Response.json(
                {
                    success: false,
                    message: "New password must be at least 6 characters.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (finalNew !== finalConfirm) {
            return Response.json(
                {
                    success: false,
                    message: "New password and confirm password do not match.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (finalNew === finalCurrent) {
            return Response.json(
                {
                    success: false,
                    message:
                        "New password must be different from current password.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.user.userId },
            select: {
                id: true,
                passwordHash: true,
            },
        });

        if (!user) {
            return Response.json(
                {
                    success: false,
                    message: "User not found.",
                    data: null,
                },
                { status: 404 }
            );
        }

        const isValid = await bcrypt.compare(
            finalCurrent,
            user.passwordHash
        );

        if (!isValid) {
            return Response.json(
                {
                    success: false,
                    message: "Current password is incorrect.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const newHash = await bcrypt.hash(finalNew, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newHash,
            },
        });

        return Response.json({
            success: true,
            message: "Password changed successfully.",
            data: null,
        });
    } catch (error) {
        console.error("Change password API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to change password.",
                data: null,
            },
            { status: 500 }
        );
    }
}