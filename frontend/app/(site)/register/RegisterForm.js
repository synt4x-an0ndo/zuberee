"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthCard from "@/components/site/AuthCard";
import PasswordInput from "@/components/PasswordInput";
import { Button, Field, Input } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, isValidBdPhone, normalizePhone } from "@/lib/api";

const EMPTY = { name: "", email: "", phone: "", password: "", confirmPassword: "" };

export default function RegisterForm() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
    setErrors({ ...errors, [key]: undefined });
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.phone.trim()) next.phone = "A mobile number is required.";
    else if (!isValidBdPhone(form.phone)) next.phone = "Enter a valid Bangladeshi mobile number (01XXXXXXXXX).";
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
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: normalizePhone(form.phone),
          password: form.password,
          confirmPassword: form.confirmPassword,
        },
        { auth: false }
      );
      toast.success("Account created. Check your email to verify it before signing in.");
      router.replace(`/verify-email?email=${encodeURIComponent(form.email.trim())}`);
    } catch (err) {
      setErrors({ form: err.message || "We could not create your account. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Join Zuberee"
      title="Create your account"
      subtitle="A valid mobile number and a verified email are required."
      footer={<>Already registered? <Link href="/login" className="link-arrow">Sign in</Link></>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {errors.form && <p className="notice notice-danger" role="alert">{errors.form}</p>}
        <Field label="Full name" htmlFor="reg-name" error={errors.name} required>
          <Input id="reg-name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={errors.email} required>
          <Input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Mobile number" htmlFor="reg-phone" error={errors.phone} hint="Bangladesh: 01XXXXXXXXX" required>
          <Input id="reg-phone" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
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