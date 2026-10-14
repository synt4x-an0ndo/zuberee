"use client";

import Link from "next/link";
import { useState } from "react";
import AuthCard from "@/components/site/AuthCard";
import { Button, Field, Input } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { toast } = useFeedback();
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
      eyebrow="Account help"
      title="Reset your password"
      subtitle="Enter the email on your account and we will send you a reset link."
      footer={<Link href="/login" className="link-arrow">Back to sign in</Link>}
    >
      {sent ? (
        <div className="notice notice-success" role="status">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. The link expires after a short time.
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {error && <p className="notice notice-danger" role="alert">{error}</p>}
          <Field label="Email" htmlFor="fp-email" required>
            <Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={busy}>Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}
