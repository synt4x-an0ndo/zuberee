"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthCard from "@/components/site/AuthCard";
import PasswordInput from "@/components/PasswordInput";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { safeNext } from "@/lib/nav";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { login } = useAuth();
  const { toast } = useFeedback();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}!`);
      // Role-based destination: admins land in the admin panel, customers in their
      // account — unless a safe ?next= destination is present (e.g. the admin guard
      // sent them here via /login?next=/admin).
      const target = next !== "/user" ? next : user?.role === "admin" || user?.role === "moderator" ? "/admin" : "/user";
      router.replace(target);
    } catch (err) {
      const message = err.message || "Sign-in failed. Please try again.";
      if (/verify your email/i.test(message)) {
        router.replace(`/verify-email?email=${encodeURIComponent(form.email.trim())}`);
        return;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in to your account"
      subtitle="Track orders, manage addresses and check out faster."
      footer={
        <>
          New here? <Link href={`/register${next !== "/user" ? `?next=${encodeURIComponent(next)}` : ""}`} className="link-arrow">Create an account</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && <p className="notice notice-danger" role="alert">{error}</p>}
        <Field label="Email" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput id="login-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <div style={{ textAlign: "right", marginTop: -8 }}>
          <Link href="/forgot-password" className="table-link" style={{ fontSize: "0.9rem" }}>Forgot password?</Link>
        </div>
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={busy}>Sign in</Button>
      </form>
    </AuthCard>
  );
}
