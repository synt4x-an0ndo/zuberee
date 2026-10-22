import bcrypt from "bcryptjs";
import prisma from "@/directory/prisma/prisma.js";
import { isValidBdPhone, isValidEmail, normalizeBdPhone, normalizeEmail } from "@/lib/contactValidation.js";
import { createEmailVerificationToken } from "@/lib/email-verification.js";
import { sendEmailVerificationEmail } from "@/lib/mailer.js";

function verificationLinkFor(token) {
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, password, confirmPassword } = body;

    if (!name || !email || !phone || !password || !confirmPassword) {
      return Response.json({ success: false, message: "Name, email, mobile number, password and confirmation are required.", data: null }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return Response.json({ success: false, message: "Password and confirm password do not match.", data: null }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ success: false, message: "Password must be at least 8 characters long.", data: null }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeBdPhone(phone);
    if (!isValidEmail(normalizedEmail)) {
      return Response.json({ success: false, message: "Enter a valid email address.", data: null }, { status: 400 });
    }
    if (!isValidBdPhone(normalizedPhone)) {
      return Response.json({ success: false, message: "Enter a valid Bangladeshi mobile number (01XXXXXXXXX).", data: null }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return Response.json({ success: false, message: "Email is already registered.", data: null }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        image: "/images/default-avatar.png",
        emailVerificationRequired: true,
      },
      select: { id: true, name: true, email: true },
    });

    try {
      const token = await createEmailVerificationToken({ userId: user.id, email: user.email });
      await sendEmailVerificationEmail({
        to: user.email,
        name: user.name,
        verificationLink: verificationLinkFor(token),
      });
    } catch (mailError) {
      // Do not retain an account that cannot receive its required activation email.
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      console.error("Registration verification email could not be delivered:", mailError?.message || mailError);
      return Response.json({
        success: false,
        message: "We could not send a verification email to this address. Check the email address and try again.",
        data: null,
      }, { status: 502 });
    }

    return Response.json({
      success: true,
      message: "Account created. Check your email to verify and activate your account.",
      data: { email: user.email, verificationRequired: true },
    }, { status: 201 });
  } catch (error) {
    console.error("Register API error:", error);
    return Response.json({ success: false, message: "Something went wrong while creating your account.", data: null }, { status: 500 });
  }
}