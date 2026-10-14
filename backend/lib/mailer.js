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

    try {
        await transporter.sendMail({
            from,
            to,
            subject: "Reset your Zuberee password",
            text: [
                `Hi ${name || "there"},`,
                "",
                "We received a request to reset your password.",
                `Reset it here (expires in 30 minutes): ${resetLink}`,
                "",
                "If you did not request this, you can ignore this email.",
            ].join("\n"),
            html: [
                `<p>Hi ${name || "there"},</p>`,
                "<p>We received a request to reset your password.</p>",
                `<p><a href="${resetLink}">Reset your password</a> (expires in 30 minutes).</p>`,
                "<p>If you did not request this, you can ignore this email.</p>",
            ].join(""),
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
