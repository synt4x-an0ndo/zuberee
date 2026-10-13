import bcrypt from "bcryptjs";
import prisma from "../../../../directory/prisma/prisma.js";

export async function POST(request) {
    try {
        const body = await request.json();

        const {
            token,
            password,
            newPassword,
            new_password,
            confirmPassword,
            confirm_password,
        } = body;

        const finalPassword =
            password ?? newPassword ?? new_password;

        const finalConfirm =
            confirmPassword ?? confirm_password;

        if (!token || typeof token !== "string" || !token.trim()) {
            return Response.json(
                {
                    success: false,
                    message: "Reset token is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (
            !finalPassword ||
            typeof finalPassword !== "string" ||
            finalPassword.length < 6
        ) {
            return Response.json(
                {
                    success: false,
                    message: "Password must be at least 6 characters.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (finalPassword !== finalConfirm) {
            return Response.json(
                {
                    success: false,
                    message:
                        "Password and confirm password do not match.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const resetRecord = await prisma.passwordResetToken.findUnique({
            where: { token: token.trim() },
        });

        if (!resetRecord) {
            return Response.json(
                {
                    success: false,
                    message: "Invalid or expired reset token.",
                    data: null,
                },
                { status: 400 }
            );
        }

        if (resetRecord.expiresAt < new Date()) {
            await prisma.passwordResetToken.delete({
                where: { id: resetRecord.id },
            });

            return Response.json(
                {
                    success: false,
                    message: "Reset token has expired.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const newHash = await bcrypt.hash(finalPassword, 10);

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: resetRecord.userId },
                data: { passwordHash: newHash },
            });

            await tx.passwordResetToken.deleteMany({
                where: { userId: resetRecord.userId },
            });
        });

        return Response.json({
            success: true,
            message: "Password reset successfully. You can now log in.",
            data: null,
        });
    } catch (error) {
        console.error("Reset password API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to reset password.",
                data: null,
            },
            { status: 500 }
        );
    }
}