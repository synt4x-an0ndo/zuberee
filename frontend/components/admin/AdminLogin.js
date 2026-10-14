"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import Img from "@/components/Img";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";

export default function AdminLogin() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const { toast } = useFeedback();
  const { siteName, company } = useSite();
  const [form, setForm] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password });
      if (user?.role !== "admin") {
        await logout();
        setError("This account does not have admin access.");
        return;
      }
      toast.success("Signed in to the admin panel.");
      router.replace("/admin");
    } catch (err) {
      setError(err.message || "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card anim-scale-in">
        <div className="admin-login-brand">
          {company.logo ? <Img src={company.logo} alt={siteName || "Store logo"} width={220} height={76} priority /> : <strong style={{ fontSize: "1.5rem" }}>{siteName || "Store"}</strong>}
          <h1>Admin Login</h1>
          <span className="admin-login-rule" aria-hidden="true" />
        </div>

        <form className="stack" onSubmit={submit} noValidate style={{ gap: "1.1rem" }}>
          {error && <p className="notice notice-danger" role="alert">{error}</p>}
          <Field label="Email address" htmlFor="admin-email">
            <div className="input-icon">
              <FiMail aria-hidden="true" />
              <Input id="admin-email" type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </Field>
          <Field label="Password" htmlFor="admin-password">
            <div className="input-icon">
              <FiLock aria-hidden="true" />
              <Input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="input-icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={busy} className="admin-login-btn">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
