"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthCard from "@/components/site/AuthCard";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

export default function VerifyEmailForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState(params.get("email") || "");
  const [status, setStatus] = useState(token ? "verifying" : "idle");
  const [message, setMessage] = useState(token ? "Verifying your email address..." : "We sent a verification link to your email address.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.post("api/auth/verify-email", { token }, { auth: false })
      .then(() => active && (setStatus("verified"), setMessage("Your email is verified. You can now sign in.")))
      .catch((error) => active && (setStatus("error"), setMessage(error.message || "Verification link is invalid or expired. Request a new one.")));
    return () => { active = false; };
  }, [token]);

  const resend = async (event) => {
    event.preventDefault();
    if (!email.trim()) return setMessage("Enter the email address used to create your account.");
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post("api/auth/resend-verification", { email: email.trim() }, { auth: false });
      setStatus("sent");
      setMessage(response?.message || "Verification email sent. Check your inbox and spam folder.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "We could not send a verification email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard eyebrow="Account security" title="Verify your email" subtitle="Open the verification link sent to your email before signing in." footer={<Link href="/login" className="link-arrow">Back to sign in</Link>}>
      <div className="stack">
        {message && <p className={status === "error" ? "notice notice-danger" : "notice notice-success"} role="status">{message}</p>}
        {status === "verified" ? (
          <Button href="/login" variant="primary" size="lg" block>Sign in</Button>
        ) : (
          <form className="stack" onSubmit={resend} noValidate>
            <Field label="Email" htmlFor="verify-email" hint="Didn't receive the message? Request a new link.">
              <Input id="verify-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Button type="submit" variant="outline" block loading={busy} disabled={busy}>Resend verification email</Button>
          </form>
        )}
      </div>
    </AuthCard>
  );
}