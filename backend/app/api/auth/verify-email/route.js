import prisma from "@/directory/prisma/prisma.js";
import { readEmailVerificationToken } from "@/lib/email-verification.js";

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== "string") {
      return Response.json({ success: false, message: "Verification link is missing.", data: null }, { status: 400 });
    }
    const { userId, email } = await readEmailVerificationToken(token);
    const user = await prisma.user.findFirst({ where: { id: userId, email }, select: { id: true, emailVerifiedAt: true } });
    if (!user) {
      return Response.json({ success: false, message: "Verification link is invalid.", data: null }, { status: 400 });
    }
    if (!user.emailVerifiedAt) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), emailVerificationRequired: false } });
    }
    return Response.json({ success: true, message: "Email verified. You can now sign in.", data: null });
  } catch (error) {
    return Response.json({ success: false, message: "Verification link is invalid or expired. Request a new one.", data: null }, { status: 400 });
  }
}