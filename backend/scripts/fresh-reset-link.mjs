/**
 * Generates a fresh password-reset link for a known account.
 *
 * This is the LOCAL-DEV escape hatch for when SMTP is not configured, so you
 * can complete the forgot-password flow without waiting on email delivery.
 *
 * Run:  npx tsx scripts/fresh-reset-link.mjs <email>
 *
 * Security notes:
 * - Reuses the exact same token shape as the real route (32 random bytes hex)
 *   and the same 30-minute expiry, so this is not a weakened token.
 * - Invalidates any previously issued token for that user first, matching the
 *   route's single-active-token behaviour.
 * - The token is single-use and expires in 30 minutes.
 */
import "dotenv/config";
import crypto from "crypto";
import prisma from "../directory/prisma/prisma.js";

const TOKEN_EXPIRY_MINUTES = 30;
const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
    console.error("Usage: npx tsx scripts/fresh-reset-link.mjs <email>");
    process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });

if (!user) {
    // Keep the same anti-enumeration wording as the real API so this script
    // does not become an oracle for probing which addresses exist.
    console.log("If that email exists, a reset link has been sent.");
    await prisma.$disconnect();
    process.exit(0);
}

const token = crypto.randomBytes(32).toString("hex");
const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
const resetLink = `${frontendUrl}/reset-password?token=${token}`;

const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

console.log("Account:", email);
console.log("SMTP configured:", smtpConfigured);
console.log("Expires at:", expiresAt.toISOString());
console.log("");
console.log("=== RESET LINK (valid 30 min, single use) ===");
console.log(resetLink);
console.log("==============================================");

await prisma.$disconnect();
process.exit(0);
