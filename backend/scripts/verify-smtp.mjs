/**
 * SMTP configuration + connection diagnostic.
 *
 * Run:  npx tsx scripts/verify-smtp.mjs
 *
 * - Reports which SMTP_* env vars are present/missing (never prints values).
 * - If configured, performs a real transporter.verify() so you see the actual
 *   connection/auth error (bad password, wrong port, blocked network, etc.)
 *   instead of guessing.
 *
 * This never sends an email and never logs credentials or reset tokens.
 */
import "dotenv/config";
import { verifyMailer } from "../lib/mailer.js";

const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SMTP_SECURE"];

console.log("=== SMTP environment check ===");
for (const key of KEYS) {
    const present = Boolean(process.env[key]);
    console.log(`${present ? "set   " : "MISSING"}  ${key}`);
}

console.log("\n=== transporter.verify() ===");
const result = await verifyMailer();
console.log("configured:", result.configured);
console.log("ok:", result.ok);
console.log("message:", result.message);

if (!result.ok) {
    console.log(
        "\nTip: for Gmail use an App Password (not your normal password) with\n" +
            "SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false."
    );
    process.exit(1);
}
console.log("\nSMTP is configured and reachable. Reset emails will be sent.");
