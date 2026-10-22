import prisma from "@/directory/prisma/prisma.js";
import { normalizeEmail, isValidEmail } from "@/lib/contactValidation.js";
import { createEmailVerificationToken } from "@/lib/email-verification.js";
import { sendEmailVerificationEmail } from "@/lib/mailer.js";

export async function POST(request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return Response.json({ success: false, message: "Enter a valid email address.", data: null }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, name: true, email: true, emailVerifiedAt: true, emailVerificationRequired: true } });
    if (!user) {
      return Response.json({ success: false, message: "No account was found for this email address.", data: null }, { status: 404 });
    }
    if (!user.emailVerificationRequired || user.emailVerifiedAt) {
      return Response.json({ success: true, message: "This email address is already verified.", data: null });
    }
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
    const token = await createEmailVerificationToken({ userId: user.id, email: user.email });
    try {
      await sendEmailVerificationEmail({ to: user.email, name: user.name, verificationLink: `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}` });
    } catch (mailError) {
      console.error("Resend verification email failed:", mailError?.message || mailError);
      return Response.json({ success: false, message: "We could not send a verification email to this address. Check the email address and try again.", data: null }, { status: 502 });
    }
    return Response.json({ success: true, message: "Verification email sent. Check your inbox and spam folder.", data: null });
  } catch (error) {
    console.error("Resend verification API error:", error);
    return Response.json({ success: false, message: "Failed to send verification email.", data: null }, { status: 500 });
  }
}