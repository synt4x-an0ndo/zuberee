"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FaArrowRight, FaBoxOpen, FaCheck, FaUser, FaRegClock, FaLock, FaChevronRight, FaPen } from "react-icons/fa6";
import { useAuth } from "@/context/AuthContext";
import { api, formatTk, imgUrl, unwrapList, unwrapObject } from "@/lib/api";
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
            if (register) {
                const response = await createAccount(form);
                notify.success(response?.message || "Your account is ready.", "Registration Complete!");
                // Documented behaviour: after register, redirect to the Login page.
                router.push("/login");
            } else {
                // login() resolves with the authenticated user ({ id, name, email, role }).
                const user = await login({ email: form.email, password: form.password });
                notify.success("Welcome back!", "Login Successful!");
                // Route by the real role returned by the documented login API:
                // verified admins -> Admin Panel, everyone else -> User Dashboard.
                const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
                router.push(isAdmin ? "/admin" : "/user");
            }
        } catch (error) {
            notify.error(error?.message || "Please check your details and try again.", register ? "Registration Failed" : "Login Failed");
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
    const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "", image: user?.image || "", password: "", confirmPassword: "" });
    const [loading, setLoading] = useState(false);
    const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const saved = await updateProfile(form);
            setForm((current) => ({ ...current, password: "", confirmPassword: "", name: saved.name, email: saved.email, phone: saved.phone || "", image: saved.image || "" }));
            onSaved("Profile updated.");
        } catch (error) { notify.error(error?.message || "Could not update your profile."); }
        finally { setLoading(false); }
    };
    return <form className="account-form profile-form" onSubmit={submit}>
        <div className="profile-form-grid">
            <label>Profile image URL<input name="image" value={form.image} onChange={change} /></label>
            <div className="avatar-preview">{form.image ? <img src={form.image} alt="preview" /> : <span className="avatar-placeholder">{user?.name?.charAt(0) || "U"}</span>}</div>
        </div>
        <div className="profile-form-grid">
            <label>Full name<input name="name" value={form.name} onChange={change} required /></label>
            <label>Email address<input type="email" name="email" value={form.email} onChange={change} required /></label>
        </div>
        <div className="profile-form-grid">
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
    if (!orders.length) return <div className="account-empty"><FaBoxOpen /><h3>No orders yet</h3><p>Your next favorite piece belongs here.</p><Link href="/shop" className="account-link">Start shopping <FaArrowRight /></Link></div>;
    return <div className="orders-list">{orders.map((order) => <article className="order-item" key={order.id}>
        <div className="order-top"><div><span className="order-label">Order #{order.id}</span><time>{new Date(order.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}</time></div><span className={`order-status ${String(order.status).toLowerCase()}`}>{order.status}</span></div>
        <div className="order-products">{(order.items || []).map((item) => <div className="order-product" key={item.id}><img src={imgUrl(item.product?.images?.[0])} alt="" /><div><strong>{item.product?.title || item.product?.name || "Product"}</strong><span>Qty {item.quantity}</span></div><b>{formatTk(Number(item.unitPrice) * item.quantity)} Tk</b></div>)}</div>
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
        if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/user");
    }, [authLoading, isAuthenticated, router]);
    useEffect(() => {
        if (!isAuthenticated) return;
        api.get("api/account/orders").then((response) => setOrders(unwrapList(response, ["orders"]))).catch(() => notify.error("Could not load your orders.")).finally(() => setOrdersLoading(false));
    }, [isAuthenticated]);

    if (authLoading || !isAuthenticated) return <AccountFrame eyebrow="Eyara account" title="Your account"><div className="account-loading">Loading your account...</div></AccountFrame>;
    return <AccountFrame eyebrow="My account" title={`Hello, ${user?.name?.split(" ")[0] || "there"}`}>
        <div className="account-toolbar"><div><FaUser /><span>{user.email}</span></div><button onClick={async () => { await logout(); router.push("/"); }}>Sign out</button></div>
        {message && <div className="account-success">{message}</div>}
        <div className="account-sections"><section className="account-section"><div className="section-kicker">Personal details</div><h2>Edit your profile</h2><ProfileForm user={user} onSaved={setMessage} /></section><section className="account-section"><div className="section-kicker">Your purchases</div><h2>Order history</h2>{ordersLoading ? <div className="account-loading">Loading orders...</div> : <Orders orders={orders} />}</section></div>
    </AccountFrame>;
}

/* =====================================================================
 * Profile Dashboard (/user)
 * A sidebar + main-content layout driven entirely by GET /api/account/me
 * (documented). Reuses the existing ProfileForm for editing and the
 * existing /user/profile, /user/orders routes. No new endpoints/routes.
 * ===================================================================== */

function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function roleLabel(role) {
    const value = String(role || "").trim().toLowerCase();
    if (!value) return null;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatJoined(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DashStat({ value, label }) {
    return (
        <div className="dash-stat">
            <span className="dash-stat-value">{value}</span>
            <span className="dash-stat-label">{label}</span>
        </div>
    );
}

function DashNavItem({ href, icon, label, active, disabled }) {
    if (disabled) {
        return (
            <button type="button" className="dash-nav-item is-disabled" aria-disabled="true" disabled>
                <span className="dash-nav-icon">{icon}</span>
                <span className="dash-nav-label">{label}</span>
                <span className="dash-nav-tag">Coming soon</span>
            </button>
        );
    }
    return (
        <Link
            href={href}
            className={`dash-nav-item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
        >
            <span className="dash-nav-icon">{icon}</span>
            <span className="dash-nav-label">{label}</span>
            <FaChevronRight className="dash-nav-chevron" aria-hidden="true" />
        </Link>
    );
}

// Reusable, auth-guarded panels used by the dedicated /user/profile and /user/orders pages.
// They reuse the same AccountFrame / ProfileForm / Orders markup as AccountPage so the UI stays identical.
export function AccountDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/user");
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        let alive = true;
        setLoading(true);
        setError("");
        api.get("api/account/me")
            .then((response) => {
                if (!alive) return;
                setProfile(unwrapObject(response) || null);
            })
            .catch((cause) => {
                if (!alive) return;
                setError(cause?.message || "Could not load your profile.");
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => { alive = false; };
    }, [isAuthenticated]);

    if (authLoading || !isAuthenticated) {
        return <AccountFrame eyebrow="Eyara account" title="Your account"><div className="account-loading">Loading your account...</div></AccountFrame>;
    }

    const firstName = (profile?.name || user?.name || "").split(" ")[0] || "there";
    const avatar = imgUrl(profile?.image);
    const joined = formatJoined(profile?.joined_at);
    const role = roleLabel(profile?.role ?? user?.role);
    const stats = profile?.stats || {};
    const primaryAddress = Array.isArray(profile?.addresses) && profile.addresses.length
        ? [profile.addresses[0].address_line, profile.addresses[0].city, profile.addresses[0].country].filter(Boolean).join(", ")
        : "";
    const phone = profile?.phone || "";

    return (
        <AccountFrame eyebrow="My account" title={`Hello, ${firstName}`}>
            {loading ? (
                <div className="account-loading">Loading your dashboard...</div>
            ) : error && !profile ? (
                <div className="empty-state text-center py-5">
                    <h2 className="h5">Profile unavailable</h2>
                    <p className="text-muted mb-0">{error}</p>
                    <button type="button" className="btn btn-outline-secondary mt-3" onClick={() => router.refresh()}>Try again</button>
                </div>
            ) : (
                <div className="dash-layout">
                    {/* ---------------- Sidebar ---------------- */}
                    <aside className="dash-sidebar">
                        <div className="dash-card dash-profile-card">
                            <div className="dash-avatar">
                                {avatar ? (
                                    <img src={avatar} alt={profile?.name || "Profile"} />
                                ) : (
                                    <span className="dash-avatar-fallback" aria-hidden="true">{initials(profile?.name || user?.name)}</span>
                                )}
                            </div>
                            <h2 className="dash-name">{profile?.name || user?.name || "Member"}</h2>
                            <p className="dash-email">{profile?.email || user?.email || ""}</p>
                            {role && <span className="dash-role">{role}</span>}
                            {joined && (
                                <p className="dash-joined"><FaRegClock aria-hidden="true" /> Member since {joined}</p>
                            )}
                        </div>

                        <div className="dash-card dash-stats-card">
                            <DashStat value={stats.total_orders ?? 0} label="Total Orders" />
                            <DashStat value={stats.wishlist ?? 0} label="Wishlist Items" />
                            <DashStat value={stats.delivered_orders ?? 0} label="Delivered Orders" />
                        </div>

                        <nav className="dash-card dash-nav-card" aria-label="Account navigation">
                            <DashNavItem href="/user" icon={<FaUser />} label="Profile Info" active={pathname === "/user"} />
                            <DashNavItem href="/user/orders" icon={<FaBoxOpen />} label="My Orders" active={pathname === "/user/orders"} />
                            <DashNavItem icon={<FaCheck />} label="Wishlist" disabled />
                            {/* No password/security endpoint exists in the backend yet. */}
                            <DashNavItem icon={<FaLock />} label="Security" disabled />
                        </nav>
                    </aside>

                    {/* ---------------- Main content ---------------- */}
                    <div className="dash-main">
                        <div className="dash-card dash-info-card">
                            <div className="dash-info-head">
                                <div>
                                    <span className="section-kicker">Personal information</span>
                                    <h2 className="dash-info-title">Your details</h2>
                                </div>
                                <button
                                    type="button"
                                    className="dash-edit-btn"
                                    onClick={() => setEditing((value) => !value)}
                                    aria-expanded={editing}
                                >
                                    <FaPen aria-hidden="true" /> {editing ? "Close editor" : "Edit Profile"}
                                </button>
                            </div>

                            <div className="dash-info-grid">
                                <div className="dash-info-field">
                                    <span className="dash-info-label">Full Name</span>
                                    <span className="dash-info-value">{profile?.name || user?.name || "—"}</span>
                                </div>
                                <div className="dash-info-field">
                                    <span className="dash-info-label">Phone Number</span>
                                    <span className="dash-info-value">{phone || "—"}</span>
                                </div>
                                <div className="dash-info-field dash-info-field--wide">
                                    <span className="dash-info-label">Address</span>
                                    <span className="dash-info-value">{primaryAddress || "—"}</span>
                                </div>
                                <div className="dash-info-field">
                                    <span className="dash-info-label">Email Address</span>
                                    <span className="dash-info-value">{profile?.email || user?.email || "—"}</span>
                                </div>
                            </div>

                            {editing && (
                                <div className="dash-editor">
                                    <ProfileForm user={{ ...(user || {}), ...(profile || {}) }} onSaved={() => setEditing(false)} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AccountFrame>
    );
}

function AccountGuard({ children }) {
    const router = useRouter();
    const { loading, isAuthenticated } = useAuth();
    useEffect(() => { if (!loading && !isAuthenticated) router.replace("/login?redirect=/user"); }, [loading, isAuthenticated, router]);
    if (loading || !isAuthenticated) return <AccountFrame eyebrow="Eyara account" title="Your account"><div className="account-loading">Loading your account...</div></AccountFrame>;
    return children;
}

export function AccountProfilePanel() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [message, setMessage] = useState("");
    return <AccountGuard>
        <div className="account-toolbar"><div><FaUser /><span>{user?.email}</span></div><button onClick={async () => { await logout(); router.push("/"); }}>Sign out</button></div>
        {message && <div className="account-success"><FaCheck /> {message}</div>}
        <section className="account-section"><div className="section-kicker">Personal details</div><h2>Edit your profile</h2><ProfileForm user={user} onSaved={setMessage} /></section>
    </AccountGuard>;
}

export function AccountOrdersPanel() {
    const { isAuthenticated } = useAuth();
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState("");
    useEffect(() => {
        if (!isAuthenticated) return;
        setOrdersLoading(true);
        setOrdersError("");
        api.get("api/account/orders")
            .then((response) => setOrders(unwrapList(response, ["orders"])))
            .catch(() => setOrdersError("Your order history is temporarily unavailable. This feature needs backend support."))
            .finally(() => setOrdersLoading(false));
    }, [isAuthenticated]);
    return <AccountGuard>
        <section className="account-section"><div className="section-kicker">Your purchases</div><h2>Order history</h2>
            {ordersLoading ? (
                <div className="account-loading">Loading orders...</div>
            ) : ordersError ? (
                <div className="account-empty"><FaBoxOpen /><h3>Orders unavailable</h3><p>{ordersError}</p></div>
            ) : (
                <Orders orders={orders} />
            )}
        </section>
    </AccountGuard>;
}
