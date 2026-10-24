import dotenv from "dotenv";
dotenv.config({ path: "/var/www/zuberee/backend/.env" });
import nodemailer from "nodemailer";
import { writeFileSync } from "node:fs";
import { getStoreBranding, buildPasswordResetEmail } from "../lib/mailer.js";

const branding = await getStoreBranding();
console.log("logoSrc:", branding.logoSrc);
console.log("attachments:", branding.logoAttachments.map((a) => ({
  filename: a.filename,
  cid: a.cid,
  disposition: a.contentDisposition,
  contentType: a.contentType,
  cte: a.contentTransferEncoding,
  bytes: a.content?.length,
})));

const email = buildPasswordResetEmail({
  name: "MIME Test",
  resetLink: "https://zuberee.com/reset-password?token=T",
  storeName: branding.storeName,
  brand: branding.brand,
  logoSrc: branding.logoSrc,
});

const transport = nodemailer.createTransport({
  streamTransport: true,
  newline: "unix",
  buffer: true,
  ignoreTLS: true,
});

const info = await transport.sendMail({
  from: "Zuberee <test@zuberee.com>",
  to: "test@example.com",
  subject: email.subject,
  text: email.text,
  html: email.html,
  attachments: branding.logoAttachments,
});

const raw = info.message.toString();
writeFileSync("/tmp/email-mime.txt", raw);

console.log("\n===== MIME STRUCTURE (headers only) =====");
for (const line of raw.split("\n")) {
  if (/^\s*$/.test(line)) break;
  console.log(line);
}
console.log("===== BODY PART HEADERS =====");
for (const m of raw.matchAll(/Content-[^\n]+/g)) {
  console.log(m[0]);
}

// Decode the image part and verify integrity
const marker = "Content-ID: <zuberee-logo@zuberee.email>";
const idx = raw.indexOf(marker);
if (idx > -1) {
  const after = raw.slice(idx);
  const b64 = after.split("\n\n")[1]?.split("--")[0]?.replace(/\s+/g, "");
  if (b64) {
    const buf = Buffer.from(b64, "base64");
    writeFileSync("/tmp/email-embedded.png", buf);
    console.log("\nembedded image bytes:", buf.length, "| PNG sig ok:", buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a");
  }
} else {
  console.log("\n!!! Content-ID marker NOT FOUND in MIME");
}
console.log("multipart/related present:", /multipart\/related/i.test(raw));
console.log("multipart/alternative present:", /multipart\/alternative/i.test(raw));
console.log("cid: reference in HTML:", /src="cid:zuberee-logo@zuberee\.email"/.test(raw));
