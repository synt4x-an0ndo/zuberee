"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { api, setToken } from "@/lib/api";
import notify from "@/components/notify";

/**
 * Admin login (/frontEnd/admin)
 *  POST api/admin/logIn  ->  { status, token, token_type, user }
 *  Persists: token (localStorage + cookie), user_id, user_name,
 *            roles[], permissions[]  - then redirects to /dashboard.
 */
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const search = useSearchParams();

  const redirectTarget = () => {
    const r = search.get("redirect");
    return r && r.startsWith("/dashboard") ? r : "/dashboard";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      notify.warn("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("api/admin/logIn", { email, password }, { auth: false });
      if (!res?.status || !res?.token || !res?.user?.id) {
        notify.error(res?.message || "Admin login failed.");
        return;
      }
      /* same persistence as the original site */
      setToken(res.token);
      localStorage.setItem("user_id", String(res.user.id));
      localStorage.setItem("user_name", res.user.name || "");
      localStorage.setItem("roles", JSON.stringify(res.user.roles || []));
      localStorage.setItem("permissions", JSON.stringify(res.user.permissions || []));
      const exp = new Date(Date.now() + 864e5 * 7).toUTCString();
      const cookie = (k, v) =>
        (document.cookie = `${k}=${encodeURIComponent(v)}; expires=${exp}; path=/; SameSite=Lax; Secure`);
      cookie("user_id", String(res.user.id));
      cookie("roles", JSON.stringify(res.user.roles || []));
      cookie("permissions", JSON.stringify(res.user.permissions || []));

      notify.success("Successfully logged in");
      window.location.href = redirectTarget();
    } catch (err) {
      notify.error(err?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5 d-flex align-items-center justify-content-center">
      <div className="col-12 col-md-6 col-lg-5">
        <div className="card shadow-lg border-0 rounded-4">
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <h1 className="h4 mb-1 text-center position-relative d-inline-block">
                Admin Login
                <span
                  className="d-block mx-auto mt-2 btn-grad"
                  style={{ width: 80, height: 5, borderRadius: 50 }}
                />
              </h1>
            </div>

            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Email Address</label>
                <input
                  type="email"
                  className="form-control form-control-lg"
                  placeholder="Enter admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3 position-relative">
                <label className="form-label fw-semibold">Password</label>
                <div className="input-group">
                  <input
                    type={showPass ? "text" : "password"}
                    className="form-control form-control-lg"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span
                    className="input-group-text bg-transparent border-start-0"
                    style={{ cursor: "pointer" }}
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-grad w-100 py-2 mt-3 fw-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Logging in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
