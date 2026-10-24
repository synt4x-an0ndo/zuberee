import dotenv from "dotenv";
dotenv.config({ path: "/var/www/zuberee/backend/.env" });
import nodemailer from "nodemailer";
import { getStoreBranding, buildPasswordResetEmail } from "../lib/mailer.js";

const branding = await getStoreBranding();
console.log("logoSrc:", branding.logoSrc);
console.log("attachments to be sent:", branding.logoAttachments.length);

const email = buildPasswordResetEmail({
  name: "The Raw Bros",
  resetLink: "https://zuberee.com/reset-password?token=LOGO-CHECK-DEMO",
  storeName: branding.storeName,
  brand: branding.brand,
  logoSrc: branding.logoSrc,
});

// Build the real transport from the same SMTP config the site uses.
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const info = await transport.sendMail({
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
  to: "hello.therawbros@gmail.com",
  subject: "Zuberee logo check - new email format",
  text: email.text,
  html: email.html,
  attachments: branding.logoAttachments,
});
console.log("sent:", info.response || info.messageId);
