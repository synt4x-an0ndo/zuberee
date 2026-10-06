"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowRight, FaBoxOpen, FaCheck, FaUser } from "react-icons/fa6";
import { useAuth } from "@/context/AuthContext";
import { api, formatTk, imgUrl } from "@/lib/api";
import notify from "@/components/notify";

function AccountFrame({ eyebrow, title, children }) {
  return (
    <section className="account-page">
      <div className="container account-container">
        <div className="account-heading">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {children}
      </div>
    </section>
  );
}

function AuthPanel({ register = false }) {
  const router = useRouter();
  const { login, register: createAccount } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (register) await createAccount(form);
      else await login({ email: form.email, password: form.password });
      notify.success(register ? "Your account is ready." : "Welcome back.");
      router.push("/account");
    } catch (error) {
      notify.error(error?.message || "Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountFrame eyebrow="Eyara account" title={register ? "Create your account" : "Welcome back"}>
      <div className="account-auth-grid">
        <div className="account-copy">
          <p>{register ? "Join us to keep every order and detail close at hand." : "Sign in to follow orders and keep your details up to date."}</p>
          <div className="account-note"><FaCheck /> Order history in one place</div>
          <div className="account-note"><FaCheck /> Faster checkout next time</div>
          <div className="account-note"><FaCheck /> Simple profile updates</div>
        </div>
        <form className="account-form" onSubmit={submit}>
          {register && <label>Full name<input name="name" value={form.name} onChange={change} required autoComplete="name" /></label>}
          <label>Email address<input type="email" name="email" value={form.email} onChange={change} required autoComplete="email" /></label>
          <label>Password<input type="password" name="password" value={form.password} onChange={change} required minLength={8} autoComplete={register ? "new-password" : "current-password"} /></label>
          {register && <label>Confirm password<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} required minLength={8} autoComplete="new-password" /></label>}
          <button className="account-submit" type="submit" disabled={loading}>{loading ? "Please wait..." : register ? "Create account" : "Sign in"}<FaArrowRight /></button>
          <p className="account-switch">{register ? "Already have an account?" : "New to Eyara?"} <Link href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link></p>
        </form>
      </div>
    </AccountFrame>
  );
}

export function LoginPage() { return <AuthPanel />; }
export function RegisterPage() { return <AuthPanel register />; }

function ProfileForm({ user, onSaved }) {
  const { updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const saved = await updateProfile(form);
      setForm((current) => ({ ...current, password: "", confirmPassword: "", name: saved.name, email: saved.email, phone: saved.phone || "" }));
      onSaved("Profile updated.");
    } catch (error) { notify.error(error?.message || "Could not update your profile."); }
    finally { setLoading(false); }
  };
  return <form className="account-form profile-form" onSubmit={submit}>
    <div className="profile-form-grid">
      <label>Full name<input name="name" value={form.name} onChange={change} required /></label>
      <label>Email address<input type="email" name="email" value={form.email} onChange={change} required /></label>
      <label>Phone number<input name="phone" value={form.phone} onChange={change} /></label>
    </div>
    <div className="profile-divider"><span>Change password</span><small>Leave blank to keep your current password.</small></div>
    <div className="profile-form-grid">
      <label>New password<input type="password" name="password" value={form.password} onChange={change} minLength={8} /></label>
      <label>Confirm new password<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} minLength={8} /></label>
    </div>
    <button className="account-submit compact" type="submit" disabled={loading}>{loading ? "Saving..." : "Save changes"}<FaCheck /></button>
  </form>;
}

function Orders({ orders }) {
  if (!orders.length) return <div className="account-empty"><FaBoxOpen /><h3>No orders yet</h3><p>Your next favorite piece belongs here.</p><Link href="/frontEnd/shop" className="account-link">Start shopping <FaArrowRight /></Link></div>;
  return <div className="orders-list">{orders.map((order) => <article className="order-item" key={order.id}>
    <div className="order-top"><div><span className="order-label">Order #{order.id}</span><time>{new Date(order.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}</time></div><span className={`order-status ${String(order.status).toLowerCase()}`}>{order.status}</span></div>
    <div className="order-products">{(order.items || []).map((item) => <div className="order-product" key={item.id}><img src={imgUrl(item.product?.images?.[0]?.imageUrl)} alt="" /><div><strong>{item.product?.name || "Product"}</strong><span>Qty {item.quantity}</span></div><b>{formatTk(Number(item.unitPrice) * item.quantity)} Tk</b></div>)}</div>
    <div className="order-total"><span>{order.shippingAddress || "Delivery address on file"}</span><strong>{formatTk(order.totalAmount)} Tk</strong></div>
  </article>)}</div>;
}

export function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/account");
  }, [authLoading, isAuthenticated, router]);
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get("api/account/orders").then((response) => setOrders(Array.isArray(response?.data) ? response.data : [])).catch(() => notify.error("Could not load your orders.")).finally(() => setOrdersLoading(false));
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) return <AccountFrame eyebrow="Eyara account" title="Your account"><div className="account-loading">Loading your account...</div></AccountFrame>;
  return <AccountFrame eyebrow="My account" title={`Hello, ${user?.name?.split(" ")[0] || "there"}`}>
    <div className="account-toolbar"><div><FaUser /><span>{user.email}</span></div><button onClick={async () => { await logout(); router.push("/"); }}>Sign out</button></div>
    {message && <div className="account-success">{message}</div>}
    <div className="account-sections"><section className="account-section"><div className="section-kicker">Personal details</div><h2>Edit your profile</h2><ProfileForm user={user} onSaved={setMessage} /></section><section className="account-section"><div className="section-kicker">Your purchases</div><h2>Order history</h2>{ordersLoading ? <div className="account-loading">Loading orders...</div> : <Orders orders={orders} />}</section></div>
  </AccountFrame>;
}