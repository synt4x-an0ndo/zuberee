import crypto from "crypto";
import prisma from "../../../../directory/prisma/prisma.js";
import { sendPasswordResetEmail } from "../../../../lib/mailer.js";

const TOKEN_EXPIRY_MINUTES = 30;

export async function POST(request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return Response.json(
                {
                    success: false,
                    message: "Email is required.",
                    data: null,
                },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Always return success to prevent email enumeration.
        if (!user) {
            return Response.json({
                success: true,
                message:
                    "If that email exists, a reset link has been sent.",
                data: null,
            });
        }

        // Random 64-char hex token (32 bytes).
        const token = crypto.randomBytes(32).toString("hex");

        const expiresAt = new Date(
            Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000
        );

        await prisma.passwordResetToken.deleteMany({
            where: { userId: user.id },
        });

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt,
            },
        });

        const frontendUrl =
            process.env.FRONTEND_URL || "http://localhost:3000";

        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        // Spec: Email (SMTP) when configured, console log in dev.
        // A delivery failure must NOT change the response shape, otherwise a
        // real account (email send throws) could be distinguished from an
        // unknown one (success) -> account enumeration. Log the real error
        // server-side only and still return the generic success below.
        try {
            await sendPasswordResetEmail({
                to: normalizedEmail,
                name: user.name,
                resetLink,
                expiresAt,
            });
        } catch (mailError) {
            console.error(
                "Forgot password: reset email could not be delivered:",
                mailError?.message || mailError
            );
        }

        return Response.json({
            success: true,
            message:
                "If that email exists, a reset link has been sent.",
            data: null,
        });
    } catch (error) {
        console.error("Forgot password API error:", error);

        return Response.json(
            {
                success: false,
                message: "Failed to process forgot password request.",
                data: null,
            },
            { status: 500 }
        );
    }
}