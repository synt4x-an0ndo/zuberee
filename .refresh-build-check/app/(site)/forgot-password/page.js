"use client";

import Link from "next/link";
import { useState } from "react";
import AuthCard from "@/components/site/AuthCard";
import { Button, Field, Input } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { toast } = useFeedback();
  const { siteName } = useSite();
  const store = siteName || "Store";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await api.post("api/auth/forgot-password", { email: email.trim() }, { auth: false });
      setSent(true);
      toast.success("If the account exists, a reset link has been sent.");
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Account Security"
      title="Reset Your Password"
      subtitle={`Enter the email on your ${store} account and we will send you a link to choose a new password.`}
      footer={<Link href="/login" className="link-arrow">Back to sign in</Link>}
    >
      {sent ? (
        <div className="notice notice-success" role="status">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. For your security,
          the link will expire in 30 minutes. If you didn&apos;t request a password reset, you can safely ignore
          that email — your password will remain unchanged.
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {error && <p className="notice notice-danger" role="alert">{error}</p>}
          <Field label="Email" htmlFor="fp-email" required>
            <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={busy}>Send Reset Link</Button>
        </form>
      )}
      <div className="auth-divider" aria-hidden="true" />
      <p className="auth-regards">
        Best regards,
        <br />
        <strong>{store} Team</strong>
      </p>
      <p className="auth-microcopy">This is an automated security page from {store}. Please do not share your reset link with anyone.</p>
    </AuthCard>
  );
}
