import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const PURPOSE = "email_verification";

export async function createEmailVerificationToken({ userId, email }) {
  return new SignJWT({ purpose: PURPOSE, userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

export async function readEmailVerificationToken(token) {
  const { payload } = await jwtVerify(token, secret);
  const userId = Number(payload.userId);
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (payload.purpose !== PURPOSE || !Number.isInteger(userId) || userId < 1 || !email) {
    throw new Error("Invalid verification token.");
  }
  return { userId, email };
}