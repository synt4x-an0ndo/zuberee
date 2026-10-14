/**
 * Genuine SMTP delivery proof for the password-reset mailer.
 *
 * Run:  npx tsx scripts/test-mailer-smtp.mjs
 *
 * It starts a tiny in-process SMTP server (Node "net", no dependencies),
 * points the REAL mailer.js at it via env vars, calls sendPasswordResetEmail,
 * and asserts that a real message was actually transmitted over SMTP and that
 * it contains the reset link. This proves delivery, not just an API "success".
 *
 * No credentials, no external network, no reset tokens written to disk/logs.
 */
import net from "net";
import { sendPasswordResetEmail } from "../lib/mailer.js";

function startSmtpServer() {
    return new Promise((resolve) => {
        const received = [];
        const server = net.createServer((socket) => {
            let inData = false;
            let current = "";
            let buf = "";
            // Send the SMTP greeting banner immediately on connect.
            socket.write("220 localhost ESMTP ready\r\n");
            socket.on("data", (chunk) => {
                buf += chunk.toString();
                // Respond line-by-line to simple SMTP commands.
                const lines = buf.split(/\r?\n/);
                buf = lines.pop(); // keep any partial trailing line
                for (const line of lines) {
                    if (inData) {
                        if (line === ".") {
                            received.push(current);
                            current = "";
                            inData = false;
                            socket.write("250 OK: queued\r\n");
                        } else {
                            current += line + "\n";
                        }
                        continue;
                    }
                    const up = line.toUpperCase();
                    if (up.startsWith("EHLO") || up.startsWith("HELO")) {
                        socket.write("250-localhost Hello\r\n250 AUTH PLAIN LOGIN\r\n");
                    } else if (up.startsWith("AUTH")) {
                        socket.write("235 Authentication succeeded\r\n");
                    } else if (up.startsWith("MAIL FROM")) {
                        socket.write("250 Sender OK\r\n");
                    } else if (up.startsWith("RCPT TO")) {
                        socket.write("250 Recipient OK\r\n");
                    } else if (up === "DATA") {
                        inData = true;
                        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
                    } else if (up === "QUIT") {
                        socket.write("221 Bye\r\n");
                        socket.end();
                    } else if (up === "RSET" || up === "NOOP") {
                        socket.write("250 OK\r\n");
                    } else if (line.length) {
                        socket.write("250 OK\r\n");
                    }
                }
            });
            socket.on("error", () => {});
        });
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve({ server, port, received });
        });
    });
}

const { server, port, received } = await startSmtpServer();

// Point the real mailer at our capture server.
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = String(port);
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASS = "test-pass";
process.env.SMTP_SECURE = "false";
process.env.SMTP_FROM = "Zuberee <no-reply@zuberee.test>";
delete process.env.NODE_ENV; // ensure we're not in production logging mode

const resetLink = "http://localhost:3000/reset-password?token=TESTTOKEN123";

const result = await sendPasswordResetEmail({
    to: "someone@example.com",
    name: "Test User",
    resetLink,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
});

server.close();

console.log("mailer returned:", result);

let ok = true;
if (result?.delivered !== true || result?.channel !== "smtp") {
    console.error("FAIL: mailer did not report a successful SMTP send.");
    ok = false;
}
if (received.length < 1) {
    console.error("FAIL: SMTP server received no message (nothing was transmitted).");
    ok = false;
} else {
    const raw = received[0];
    // Decode MIME quoted-printable so the assertion reflects what a mail
    // client actually shows after decoding. Soft line breaks are "=\r\n" and
    // "="; bytes are "=XX". This does NOT touch credentials or tokens on disk.
    const decoded = raw
        .replace(/=(?:\r?\n)/g, "") // remove soft line breaks
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
    const hasSubject = /Subject:\s*Reset your Zuberee password/i.test(raw);
    const hasRecipient = /someone@example\.com/i.test(raw);
    const hasLink = decoded.includes(resetLink);
    console.log("captured message bytes:", raw.length);
    console.log("has subject:", hasSubject);
    console.log("has recipient:", hasRecipient);
    console.log("has reset link:", hasLink);
    if (!hasSubject) { console.error("FAIL: subject missing."); ok = false; }
    if (!hasRecipient) { console.error("FAIL: recipient missing."); ok = false; }
    if (!hasLink) {
        console.error("FAIL: reset link missing from body.");
        console.error("---- RAW CAPTURED MESSAGE ----");
        console.error(raw);
        console.error("---- END RAW ----");
        ok = false;
    }
}

if (!ok) {
    console.error("\nSMTP DELIVERY TEST FAILED");
    process.exit(1);
}
console.log("\nSMTP DELIVERY TEST PASSED: the mailer genuinely sent an email containing the reset link.");
