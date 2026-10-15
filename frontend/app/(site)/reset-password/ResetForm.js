"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthCard from "@/components/site/AuthCard";
import PasswordInput from "@/components/PasswordInput";
import { Button, Field } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";

export default function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const { toast } = useFeedback();
  const { siteName } = useSite();
  const store = siteName || "Store";
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!token) return setError("This reset link is incomplete. Request a new one.");
    if (form.password.length < 8) return setError("Use at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await api.post("api/auth/reset-password", { token, password: form.password, confirmPassword: form.confirmPassword }, { auth: false });
      toast.success("Password updated. Please sign in.");
      router.replace("/login");
    } catch (err) {
      setError(err.message || "This link has expired. Request a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Account Security"
      title="Reset Your Password"
      subtitle={`Choose a new password for your ${store} account.`}
      footer={<Link href="/forgot-password" className="link-arrow">Request a new link</Link>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <p className="notice notice-danger" role="alert">{error}</p>}
        <Field label="New password" htmlFor="rp-password" required>
          <PasswordInput id="rp-password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Confirm new password" htmlFor="rp-confirm" required>
          <PasswordInput id="rp-confirm" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={busy}>Reset Password</Button>
      </form>
      <p className="auth-note">
        For your security, this link will expire in 30 minutes. If you didn&apos;t request a password reset,
        you can safely ignore the email that brought you here — your password will remain unchanged.
      </p>
      <div className="auth-divider" aria-hidden="true" />
      <p className="auth-regards">
        Best regards,
        <br />
        <strong>{store} Team</strong>
      </p>
      <p className="auth-microcopy">This is an automated security page from {store}. Please keep your reset link private.</p>
    </AuthCard>
  );
}
