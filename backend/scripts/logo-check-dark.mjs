import dotenv from "dotenv";
dotenv.config({ path: "/var/www/zuberee/backend/.env" });
import nodemailer from "nodemailer";
import { getStoreBranding, buildEmailVerificationEmail } from "../lib/mailer.js";

const branding = await getStoreBranding();
console.log("logoSrc:", branding.logoSrc, "| attachments:", branding.logoAttachments.length);

const email = buildEmailVerificationEmail({
  name: "The Raw Bros",
  verificationLink: "https://zuberee.com/verify-email?token=LOGO-CHECK-DEMO",
  storeName: branding.storeName,
  brand: branding.brand,
  logoSrc: branding.logoSrc,
});

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const info = await transport.sendMail({
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
  to: "hello.therawbros@gmail.com",
  subject: "Zuberee logo check - logo on dark",
  text: email.text,
  html: email.html,
  attachments: branding.logoAttachments,
});
console.log("sent:", info.response || info.messageId);
