"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { api, setToken } from "@/lib/api";
import notify from "@/components/notify";

/**
 * Admin login (/login/admin)
 *  POST api/auth/login  ->  { success, message, data: { token, user } }
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

  const redirectTarget = (role) => {
    // Only verified admins may enter the Admin Panel; anyone else is a
    // regular user and belongs on the User Dashboard (/account).
    const isAdmin = String(role || "").toUpperCase() === "ADMIN";
    if (!isAdmin) return "/user";
    const r = search.get("redirect");
    return r && r.startsWith("/admin") ? r : "/admin";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      notify.warn("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("api/auth/login", { email, password }, { auth: false });
      const data = res?.data || {};
      if (!res?.success || !data.token || !data.user?.id) {
        notify.error(res?.message || "Admin login failed.", "Login Failed");
        return;
      }
      /* same persistence as the original site */
      setToken(data.token);
      localStorage.setItem("user_id", String(data.user.id));
      localStorage.setItem("user_name", data.user.name || "");
      const roles = data.user.roles?.length
        ? data.user.roles
        : String(data.user.role || "").toUpperCase() === "ADMIN"
          ? ["super-admin"]
          : [];
      localStorage.setItem("roles", JSON.stringify(roles));
      localStorage.setItem("permissions", JSON.stringify(data.user.permissions || []));
      const exp = new Date(Date.now() + 864e5 * 7).toUTCString();
      const cookie = (k, v) =>
        (document.cookie = `${k}=${encodeURIComponent(v)}; expires=${exp}; path=/; SameSite=Lax; Secure`);
      cookie("user_id", String(data.user.id));
      cookie("roles", JSON.stringify(roles));
      cookie("permissions", JSON.stringify(data.user.permissions || []));

      notify.success("Successfully logged in", "Login Successful!");
      window.location.href = redirectTarget(data.user?.role);
    } catch (err) {
      notify.error(err?.message || "An error occurred.", "Login Failed");
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
