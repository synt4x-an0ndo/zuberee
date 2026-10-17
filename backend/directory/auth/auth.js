import { jwtVerify } from "jose";
import prisma from "../prisma/prisma.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function authenticateRequest(request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { authenticated: false, message: "Authorization token is required." };
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(authorization.substring(7), secret));
  } catch {
    return { authenticated: false, message: "Invalid or expired token." };
  }
  if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
    return { authenticated: false, message: "Invalid user identity." };
  }
  // Never trust a stale JWT role after an account is removed or its role changes.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId }, select: { id: true, email: true, role: true },
  });
  if (!user) return { authenticated: false, message: "Account no longer exists." };
  return { authenticated: true, user: { userId: user.id, email: user.email, role: user.role } };
}
