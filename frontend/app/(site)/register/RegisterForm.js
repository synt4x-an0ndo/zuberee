"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import AuthCard from "@/components/site/AuthCard";
import PasswordInput from "@/components/PasswordInput";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { safeNext } from "@/lib/nav";

const EMPTY = { name: "", email: "", password: "", confirmPassword: "" };

export default function RegisterForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { login } = useAuth();
  const { toast } = useFeedback();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: undefined });
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      await api.post(
        "api/auth/register",
        { name: form.name.trim(), email: form.email.trim(), password: form.password, confirmPassword: form.confirmPassword },
        { auth: false }
      );
      toast.success("Account created. Signing you in…");
      try {
        await login({ email: form.email.trim(), password: form.password });
        router.replace(next);
      } catch {
        router.replace("/login");
      }
    } catch (err) {
      setErrors({ form: err.message || "We could not create your account. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Join Eyara"
      title="Create your account"
      subtitle="Save your details for faster checkout and order tracking."
      footer={
        <>
          Already registered? <Link href="/login" className="link-arrow">Sign in</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {errors.form && <p className="notice notice-danger" role="alert">{errors.form}</p>}
        <Field label="Full name" htmlFor="reg-name" error={errors.name} required>
          <Input id="reg-name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={errors.email} required>
          <Input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="reg-password" error={errors.password} hint={errors.password ? undefined : "At least 8 characters."} required>
          <PasswordInput id="reg-password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-invalid={!!errors.password} />
        </Field>
        <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirmPassword} required>
          <PasswordInput id="reg-confirm" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={busy}>Create account</Button>
      </form>
    </AuthCard>
  );
}
