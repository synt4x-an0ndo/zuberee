/**
 * Password-reset mailer.
 *
 * Spec: "Token delivered: Email (SMTP) or console log (dev)".
 *
 * - When SMTP env vars are configured, sends a real email via nodemailer.
 * - Otherwise (dev / no SMTP configured), logs the reset link to console
 *   so developers can still complete the flow.
 *
 * Expected env vars (all optional until SMTP is needed):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *   SMTP_FROM (fallback: SMTP_USER), SMTP_SECURE ("true"/"false")
 */

function isSmtpConfigured() {
    return Boolean(
        process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS
    );
}

function logResetLink({ to, resetLink, expiresAt }) {
    console.log("=== PASSWORD RESET LINK ===");
    console.log("Email:", to);
    console.log("Link:", resetLink);
    console.log("Expires:", expiresAt);
    console.log("===========================");
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

    // Import lazily so the app boots even when nodemailer isn't installed
    // (dev environments that rely on console logging).
    let nodemailer;
    try {
        const mod = await import("nodemailer");
        nodemailer = mod.default ?? mod;
    } catch (error) {
        console.error(
            "SMTP is configured but 'nodemailer' is not installed. Falling back to console log. Run: npm install nodemailer"
        );
        logResetLink({ to, resetLink, expiresAt });
        return { delivered: false, channel: "console" };
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
        String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
        port === 465;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const from =
        process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@zuberee";

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

    return { delivered: true, channel: "smtp" };
}
