import { readSetting } from "./settings-store.js";

/**
 * Password-reset mailer.
 *
 * Spec: "Token delivered: Email (SMTP) or console log (dev)".
 *
 * - When SMTP env vars are configured, sends a real email via nodemailer.
 * - Otherwise (dev / no SMTP configured), logs the reset link to console
 *   so developers can still complete the flow.
 *
 * Security: the reset link contains a live, single-use token. It is NEVER
 * written to the console in production. When SMTP is not configured in
 * production we log a safe warning instead of the link.
 *
 * Expected env vars (all optional until SMTP is needed):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *   SMTP_FROM (fallback: SMTP_USER), SMTP_SECURE ("true"/"false")
 */

function isProduction() {
    return process.env.NODE_ENV === "production";
}

function isSmtpConfigured() {
    return Boolean(
        process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS
    );
}

function logResetLink({ to, resetLink, expiresAt }) {
    // Never leak a live reset token/link into production logs.
    if (isProduction()) {
        console.warn(
            "[mailer] Reset link generated but SMTP is not configured; " +
                "email NOT sent. Set SMTP_HOST/SMTP_USER/SMTP_PASS. " +
                "(Link intentionally not logged in production.)"
        );
        return;
    }

    console.log("=== PASSWORD RESET LINK (dev) ===");
    console.log("Email:", to);
    console.log("Link:", resetLink);
    console.log("Expires:", expiresAt);
    console.log("=================================");
}

/**
 * Build a nodemailer transport from the current SMTP_* env vars.
 * Exposed so the verify helper can reuse the exact same configuration.
 */
async function createTransporter() {
    let nodemailer;
    try {
        const mod = await import("nodemailer");
        nodemailer = mod.default ?? mod;
    } catch (error) {
        console.error(
            "SMTP is configured but 'nodemailer' is not installed. Run: npm install nodemailer"
        );
        throw error;
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
        String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
        port === 465;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
}

const SITE_SETTING_DEFAULTS = { site_name: "", primary_color: "#ff641f" };

function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
    return `#${hex}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Store branding for transactional mail: the same site name and primary
 * colour the admin sets in the admin panel (site-settings), so the email
 * always matches the storefront theme. Falls back to the defaults used by
 * the site-settings route when nothing has been saved yet.
 */
/**
 * The store logo (Admin -> Footer settings) prepared for email:
 * - data-URI logos (how the admin panel stores uploads) become a CID
 *   attachment, which even Gmail renders; the HTML references the cid.
 * - http(s) logos are referenced directly.
 * - relative paths are made absolute with FRONTEND_URL when configured.
 */
function prepareEmailLogo(rawLogo, storeName) {
    const raw = typeof rawLogo === "string" ? rawLogo.trim() : "";
    if (!raw) return { logoSrc: null, attachments: [] };

    const dataMatch = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (dataMatch) {
        const cid = "store-logo@zuberee";
        return {
            logoSrc: `cid:${cid}`,
            attachments: [
                {
                    filename: "logo.png",
                    content: Buffer.from(dataMatch[2], "base64"),
                    contentType: dataMatch[1],
                    cid,
                },
            ],
        };
    }

    if (/^https?:\/\//i.test(raw)) return { logoSrc: raw, attachments: [] };

    const base = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
    if (base) return { logoSrc: `${base}/${raw.replace(/^\/+/, "")}`, attachments: [] };

    return { logoSrc: null, attachments: [] };
}

export async function getStoreBranding() {
    const settings = await readSetting("site-settings", SITE_SETTING_DEFAULTS);
    const footer = await readSetting("footer-settings", {});
    const storeName = (settings.site_name || "").trim() || "Zuberee";
    const { logoSrc, attachments } = prepareEmailLogo(
        footer.company_logo || footer.logo_path,
        storeName
    );
    return {
        storeName,
        brand: normalizeHex(settings.primary_color) || SITE_SETTING_DEFAULTS.primary_color,
        logoSrc,
        logoAttachments: attachments,
    };
}

/**
 * Build the password-reset email (subject + text + HTML) in the store's
 * theme. Exported for previews/tests; sendPasswordResetEmail uses it too.
 */
export function buildPasswordResetEmail({ name, resetLink, storeName, brand, logoSrc = null }) {
    const store = escapeHtml(storeName);
    const greeting = escapeHtml(name || "there");
    const subject = `Reset your ${storeName} password`;

    const text = [
        `${storeName} - Account Security`,
        "",
        "Reset Your Password",
        "",
        `Hi ${name || "there"},`,
        "",
        `We received a request to reset the password for your ${storeName} account.`,
        "",
        "Click the link below to choose a new password. For your security, this link will expire in 30 minutes:",
        resetLink,
        "",
        "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
        "",
        "Best regards,",
        `${storeName} Team`,
        "",
        `This is an automated security email from ${storeName}. Please do not reply to this message.`,
    ].join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:16px;">
<tr><td style="padding:40px 44px 8px;text-align:center;">
${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="${store}" style="display:block;margin:0 auto;max-width:220px;max-height:56px;width:auto;height:auto;">` : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;color:${brand};">${store}</div>`}
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#5f6b66;margin-top:6px;">Account Security</div>
</td></tr>
<tr><td style="padding:20px 44px 0;"><div style="border-top:1px solid #e8ecea;font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td style="padding:26px 44px 40px;font-family:Arial,Helvetica,sans-serif;color:#1c2420;">
<div style="font-size:27px;font-weight:700;color:#141a17;">Reset Your Password</div>
<p style="font-size:16px;line-height:1.55;margin:22px 0 0;">Hi ${greeting},</p>
<p style="font-size:16px;line-height:1.55;margin:16px 0 0;">We received a request to reset the password for your ${store} account.</p>
<p style="font-size:16px;line-height:1.55;margin:16px 0 0;">Click the button below to choose a new password. For your security, this link will expire in 30 minutes.</p>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:30px auto 6px;">
<tr><td align="center" bgcolor="${brand}" style="border-radius:10px;">
<a href="${escapeHtml(resetLink)}" target="_blank" style="display:inline-block;padding:15px 38px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;">Reset Password</a>
</td></tr>
</table>
<p style="font-size:12px;line-height:1.5;color:#8a948f;text-align:center;margin:10px 0 0;">Button not working? Copy and paste this link into your browser:<br><a href="${escapeHtml(resetLink)}" target="_blank" style="color:${brand};word-break:break-all;">${escapeHtml(resetLink)}</a></p>
<p style="font-size:16px;line-height:1.55;margin:24px 0 0;">If you didn&#39;t request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
<p style="font-size:16px;line-height:1.55;margin:24px 0 0;">Best regards,<br><strong>${store} Team</strong></p>
</td></tr>
<tr><td style="padding:0 44px;"><div style="border-top:1px solid #e8ecea;font-size:0;line-height:0;">&nbsp;</div></td></tr>
<tr><td style="padding:16px 44px 34px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#8a948f;">
This is an automated security email from ${store}. Please do not reply to this message.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    return { subject, text, html };
}

export async function sendPasswordResetEmail({
    to,
    name,
    resetLink,
    expiresAt,
}) {
    if (!isSmtpConfigured()) {
        logResetLink({ to, resetLink, expiresAt });
        return { delivered: false, channel: "console" };
    }

    const transporter = await createTransporter();

    const from =
        process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@zuberee";

    const { storeName, brand, logoSrc, logoAttachments } = await getStoreBranding();
    const email = buildPasswordResetEmail({ name, resetLink, storeName, brand, logoSrc });

    try {
        await transporter.sendMail({
            from,
            to,
            subject: email.subject,
            text: email.text,
            html: email.html,
            attachments: logoAttachments,
        });
    } catch (error) {
        // Surface the real SMTP error (auth failed, connection refused, etc.)
        // so it shows up in the backend console, then rethrow so the caller
        // can keep the response generic.
        console.error("[mailer] SMTP send failed:", error?.message || error);
        throw error;
    }

    return { delivered: true, channel: "smtp" };
}

/**
 * Health check used by scripts/verify-smtp.mjs.
 * Verifies the SMTP connection + credentials without sending mail.
 * Never prints credentials.
 */
export async function verifyMailer() {
    if (!isSmtpConfigured()) {
        return {
            configured: false,
            ok: false,
            message:
                "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.",
        };
    }

    try {
        const transporter = await createTransporter();
        await transporter.verify();
        return {
            configured: true,
            ok: true,
            message: `SMTP connection verified for host ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}.`,
        };
    } catch (error) {
        return {
            configured: true,
            ok: false,
            message: error?.message || String(error),
        };
    }
}

export function buildEmailVerificationEmail({ name, verificationLink, storeName, brand, logoSrc = null }) {
    const store = escapeHtml(storeName);
    const greeting = escapeHtml(name || "there");
    const subject = `Verify your ${storeName} email address`;
    const text = [
        `${storeName} - Verify your email`,
        "",
        `Hi ${name || "there"},`,
        "",
        `Please verify your email address to activate your ${storeName} account:`,
        verificationLink,
        "",
        "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
    ].join("\n");
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c2420;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:38px 42px 12px;text-align:center;">
        ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="${store}" style="display:block;margin:0 auto;max-width:220px;max-height:56px;">` : `<div style="font-size:30px;font-weight:700;color:${brand};">${store}</div>`}
      </td></tr>
      <tr><td style="padding:18px 42px 40px;">
        <h1 style="margin:0;font-size:27px;color:#141a17;">Verify your email</h1>
        <p style="font-size:16px;line-height:1.55;margin:22px 0 0;">Hi ${greeting},</p>
        <p style="font-size:16px;line-height:1.55;margin:16px 0 0;">Confirm this email address to activate your ${store} account.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0;"><tr><td bgcolor="${brand}" style="border-radius:10px;">
          <a href="${escapeHtml(verificationLink)}" style="display:inline-block;padding:15px 32px;color:#fff;font-size:16px;font-weight:700;text-decoration:none;">Verify email address</a>
        </td></tr></table>
        <p style="font-size:13px;line-height:1.5;color:#6f7873;word-break:break-all;">If the button does not work, copy this link into your browser:<br><a href="${escapeHtml(verificationLink)}" style="color:${brand};">${escapeHtml(verificationLink)}</a></p>
        <p style="font-size:14px;line-height:1.5;color:#6f7873;">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
    return { subject, text, html };
}

export async function sendEmailVerificationEmail({ to, name, verificationLink }) {
    if (!isSmtpConfigured()) {
        throw new Error("Email verification is unavailable because SMTP is not configured.");
    }
    const transporter = await createTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@zuberee";
    const { storeName, brand, logoSrc, logoAttachments } = await getStoreBranding();
    const email = buildEmailVerificationEmail({ name, verificationLink, storeName, brand, logoSrc });
    await transporter.sendMail({
        from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: logoAttachments,
    });
    return { delivered: true, channel: "smtp" };
}