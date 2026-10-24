import dotenv from "dotenv";
dotenv.config({ path: "/var/www/zuberee/backend/.env" });
import {
  getStoreBranding,
  buildPasswordResetEmail,
  buildEmailVerificationEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
} from "../lib/mailer.js";

const branding = await getStoreBranding();
console.log("storeName:", branding.storeName);
console.log("brand:", branding.brand);
console.log("logoSrc:", branding.logoSrc);
console.log("attachments:", branding.logoAttachments.map((a) => ({
  filename: a.filename,
  contentType: a.contentType,
  bytes: Buffer.isBuffer(a.content) ? a.content.length : 0,
  cid: a.cid,
})));

const reset = buildPasswordResetEmail({
  name: "Test User",
  resetLink: "https://zuberee.com/reset-password?token=TESTTOKEN",
  storeName: branding.storeName,
  brand: branding.brand,
  logoSrc: branding.logoSrc,
});
const verify = buildEmailVerificationEmail({
  name: "Test User",
  verificationLink: "https://zuberee.com/verify-email?token=TESTTOKEN",
  storeName: branding.storeName,
  brand: branding.brand,
  logoSrc: branding.logoSrc,
});

for (const [name, email] of [["RESET", reset], ["VERIFY", verify]]) {
  const localhostRefs = email.html.match(/localhost[^"' <]*/g) || [];
  const imgs = email.html.match(/<img[^>]*src="[^"]*"/g) || [];
  console.log(`--- ${name} ---`);
  console.log("localhost refs in HTML:", localhostRefs.length ? localhostRefs : "NONE (good)");
  console.log("img tags:", imgs.length ? imgs : "(none)");
}

const target = process.env.SMTP_USER;
console.log("\nSending real test emails to", target, "...");
const r1 = await sendPasswordResetEmail({
  to: target,
  name: "Zuberee Test",
  resetLink: "https://zuberee.com/reset-password?token=TESTTOKEN",
});
const r2 = await sendEmailVerificationEmail({
  to: target,
  name: "Zuberee Test",
  verificationLink: "https://zuberee.com/verify-email?token=TESTTOKEN",
});
console.log("reset email:", r1, "| verification email:", r2);
