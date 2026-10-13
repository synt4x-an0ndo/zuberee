"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FaArrowRight, FaBoxOpen, FaCheck, FaUser, FaRegClock, FaChevronRight, FaPen, FaEye, FaEyeSlash } from "react-icons/fa6";
import { useAuth } from "@/context/AuthContext";
import { api, formatPhone, formatTk, imgUrl, phoneLocal, unwrapList, unwrapObject } from "@/lib/api";
import { normalizeOrders } from "@/lib/order";
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
                    {!register && <p className="account-switch"><Link href="/forgot-password">Forgot your password?</Link></p>}
                    <p className="account-switch">{register ? "Already have an account?" : "New to Eyara?"} <Link href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link></p>
                </form>
            </div>
        </AccountFrame>
    );
}

export function LoginPage() { return <AuthPanel />; }
export function RegisterPage() { return <AuthPanel register />; }

function RequireNoAuth({ children }) {
    const router = useRouter();
    const { loading, isAuthenticated } = useAuth();
    useEffect(() => { if (!loading && isAuthenticated) router.replace("/user"); }, [loading, isAuthenticated, router]);
    if (loading || isAuthenticated) return <AccountFrame eyebrow="Eyara account" title="Your account"><div className="account-loading">Loading your account...</div></AccountFrame>;
    return children;
}

function PasswordField({ label, name, value, onChange, minLength = 6 }) {
    const [visible, setVisible] = useState(false);
    return (
        <label>{label}<div className="password-input"><input type={visible ? "text" : "password"} name={name} value={value} onChange={onChange} minLength={minLength} required autoComplete="new-password" /><button type="button" aria-label={visible ? `Hide ${label}` : `Show ${label}`} onClick={() => setVisible((v) => !v)}>{visible ? <FaEyeSlash /> : <FaEye />}</button></div></label>
    );
}

function ProfileForm({ user, onSaved }) {
    const { updateProfile, uploadAvatar } = useAuth();
    const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", phone: phoneLocal(user?.phone), image: user?.image || "" });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [imageError, setImageError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [loading, setLoading] = useState(false);
    const [addresses, setAddresses] = useState(Array.isArray(user?.addresses) ? user.addresses : []);
    const [addressesLoading, setAddressesLoading] = useState(false);
    const [addressForm, setAddressForm] = useState({ id: null, full_name: "", address_line: "", city: "", postal_code: "", country: "Bangladesh", keepPhone: "" });
    const [addressEditing, setAddressEditing] = useState(false);
    const [addressSaving, setAddressSaving] = useState(false);
    const [addressError, setAddressError] = useState("");

    useEffect(() => {
        let alive = true;
        const loadAddresses = async () => {
            setAddressesLoading(true);
            try {
                const response = await api.get("api/account/addresses");
                const list = unwrapList(response, ["addresses"]) || unwrapList(response?.data, ["addresses"]) || [];
                if (alive) setAddresses(Array.isArray(list) ? list : []);
            } catch {
                // Fall back to the addresses already embedded in /account/me.
                if (alive && Array.isArray(user?.addresses)) setAddresses(user.addresses);
            } finally {
                if (alive) setAddressesLoading(false);
            }
        };
        loadAddresses();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetAddressForm = () => {
        setAddressForm({ id: null, full_name: "", address_line: "", city: "", postal_code: "", country: "Bangladesh", keepPhone: "" });
        setAddressEditing(false);
        setAddressError("");
    };

    const startAddAddress = () => {
        setAddressForm({ id: null, full_name: user?.name || "", address_line: "", city: "", postal_code: "", country: "Bangladesh", keepPhone: "" });
        setAddressEditing(true);
        setAddressError("");
    };

    const startEditAddress = (address) => {
        setAddressForm({
            id: address?.id ?? null,
            full_name: address?.full_name || address?.fullName || "",
            address_line: address?.address_line || address?.addressLine || "",
            city: address?.city || "",
            postal_code: address?.postal_code || address?.postalCode || "",
            country: address?.country || "Bangladesh",
            keepPhone: address?.phone || "",
        });
        setAddressEditing(true);
        setAddressError("");
    };

    const saveAddress = async (event) => {
        event?.preventDefault?.();
        if (!addressForm.full_name.trim() || !addressForm.address_line.trim() || !addressForm.city.trim()) {
            setAddressError("Full name, address and city are required.");
            return;
        }
        setAddressSaving(true);
        setAddressError("");
        try {
            const rawFallback = user?.phone || (form.phone ? formatPhone(form.phone) : "");
            const payload = {
                full_name: addressForm.full_name.trim(),
                phone: (addressForm.keepPhone || rawFallback || "01XXXXXXXXX").trim(),
                address_line: addressForm.address_line.trim(),
                city: addressForm.city.trim(),
                postal_code: addressForm.postal_code.trim() || null,
                country: addressForm.country.trim() || "Bangladesh",
            };
            let saved = null;
            if (addressForm.id) {
                const response = await api.put(`api/account/addresses/${addressForm.id}`, payload);
                saved = unwrapObject(response) || unwrapObject(response?.data) || null;
                setAddresses((current) => current.map((item) => (item.id === addressForm.id ? { ...item, ...(saved || payload) } : item)));
                notify.success("Address updated successfully.", "Address saved");
            } else {
                const response = await api.post("api/account/addresses", payload);
                saved = unwrapObject(response) || unwrapObject(response?.data) || null;
                const created = saved?.id ? saved : { ...payload, id: Date.now() };
                setAddresses((current) => [created, ...current]);
                notify.success("Address added successfully.", "Address saved");
            }
            window.dispatchEvent(new Event("address-changed"));
            resetAddressForm();
        } catch (error) {
            setAddressError(error?.message || "Could not save this address.");
        } finally {
            setAddressSaving(false);
        }
    };

    const deleteAddress = async (id) => {
        if (!id || !window.confirm("Delete this address?")) return;
        try {
            await api.delete(`api/account/addresses/${id}`);
            setAddresses((current) => current.filter((item) => item.id !== id));
            if (addressForm.id === id) resetAddressForm();
            window.dispatchEvent(new Event("address-changed"));
            notify.success("Address deleted successfully.", "Address removed");
        } catch (error) {
            notify.error(error?.message || "Could not delete this address.");
        }
    };
    const change = (event) => {
        const { name, value } = event.target;
        const nextValue = name === "phone" ? phoneLocal(value).slice(0, 10) : value;
        setForm((current) => ({ ...current, [name]: nextValue }));
        if (name === "phone") setPhoneError(nextValue && !/^1\d{9}$/.test(nextValue) ? "Use 10 digits in the format 1XXXXXXXXX." : "");
    };
    const submit = async (event) => {
        event.preventDefault();
        if (form.phone && !/^1\d{9}$/.test(form.phone)) {
            setPhoneError("Use 10 digits in the format 1XXXXXXXXX.");
            return;
        }
        setLoading(true);
        try {
            // Spec: PUT /api/account/profile accepts only name + phone.
            // Avatar uploads go to POST /api/account/upload-avatar (multipart).
            // Email is read-only — never sent to the backend.
            const saved = await updateProfile({
                name: form.name,
                phone: formatPhone(form.phone) || null,
            });
            const uploaded = imageFile ? await uploadAvatar(imageFile) : null;
            const profileImage = uploaded?.image ?? uploaded?.user?.image ?? saved?.image ?? form.image;
            setForm((current) => ({
                ...current,
                name: saved?.name ?? current.name,
                email: saved?.email ?? current.email,
                phone: phoneLocal(saved?.phone ?? current.phone),
                image: profileImage,
            }));
            setImageFile(null);
            setImagePreview("");
            setImageError("");
            onSaved("Profile updated.");
        } catch (error) { notify.error(error?.message || "Could not update your profile."); }
        finally { setLoading(false); }
    };
    return <div className="account-form profile-form">
        <form onSubmit={submit} className="profile-inner-form">
        <div className="profile-form-grid">
            <label>Profile image URL<input name="image" value={form.image} onChange={change} /></label>
            <label>Upload profile image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file && file.size > 2 * 1024 * 1024) {
                    setImageFile(null);
                    setImageError("Image must be 2 MB or smaller.");
                    event.target.value = "";
                    return;
                }
                setImageFile(file);
                setImagePreview(file ? URL.createObjectURL(file) : "");
                setImageError("");
            }} /><small>JPG, PNG, or WebP. Maximum 2 MB.</small>{imageError && <small role="alert">{imageError}</small>}</label>
            <div>
                <div className="avatar-preview">{(imagePreview || imgUrl(form.image) || form.image) ? <img src={imagePreview || imgUrl(form.image) || form.image} alt="preview" /> : <span className="avatar-placeholder">{user?.name?.charAt(0) || "U"}</span>}</div>
                {imageFile && <button type="button" className="image-crop-button" onClick={() => {
                    const image = new Image();
                    image.onload = () => {
                        const side = Math.min(image.naturalWidth, image.naturalHeight);
                        const canvas = document.createElement("canvas");
                        canvas.width = 600;
                        canvas.height = 600;
                        canvas.getContext("2d").drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 600, 600);
                        canvas.toBlob((blob) => {
                            if (!blob) return;
                            const cropped = new File([blob], imageFile.name, { type: imageFile.type });
                            setImageFile(cropped);
                            setImagePreview(URL.createObjectURL(cropped));
                        }, imageFile.type, 0.9);
                    };
                    image.src = imagePreview;
                }}>Crop image to square</button>}
            </div>
        </div>
        <div className="profile-form-grid">
            <label>Full name<input name="name" value={form.name} onChange={change} required /></label>
            <label>Email address<input type="email" name="email" value={form.email} readOnly disabled aria-readonly="true" title="Email cannot be changed" /></label>
        </div>
        <div className="profile-form-grid">
            <label>Phone number<div className="account-phone-input"><span className="account-phone-prefix">+880</span><input name="phone" value={form.phone} onChange={change} inputMode="numeric" maxLength={10} pattern="1[0-9]{9}" aria-describedby="profile-phone-hint" /></div><small id="profile-phone-hint">Enter 10 digits in the format 1XXXXXXXXX.</small>{phoneError && <small role="alert">{phoneError}</small>}</label>
        </div>
        <div className="profile-divider"><span>Change password</span><small>Uses PUT /api/account/change-password.</small></div>
        <ChangePasswordForm />
        <button className="account-submit compact" type="submit" disabled={loading}>{loading ? "Saving..." : "Save changes"}<FaCheck /></button>
        </form>
        <div className="profile-divider"><span>Delivery addresses</span><small>Add or edit the address used at checkout.</small></div>
        <div className="address-manager">
            {addressesLoading ? (
                <div className="account-loading">Loading addresses...</div>
            ) : addresses.length ? (
                <ul className="address-list">
                    {addresses.map((address) => {
                        const line = [address?.address_line || address?.addressLine, address?.city, address?.postal_code || address?.postalCode, address?.country].filter(Boolean).join(", ");
                        const name = address?.full_name || address?.fullName || "";
                        return (
                            <li key={address.id} className="address-item">
                                <div>
                                    <strong>{name}{address?.phone ? ` · ${address.phone}` : ""}</strong>
                                    <span>{line || "—"}</span>
                                </div>
                                <div className="address-actions">
                                    <button type="button" className="address-btn" onClick={() => startEditAddress(address)}>Edit</button>
                                    <button type="button" className="address-btn danger" onClick={() => deleteAddress(address.id)}>Delete</button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="address-empty">No saved address yet. Add one so checkout is faster next time.</p>
            )}
            {!addressEditing ? (
                <button type="button" className="address-btn primary" onClick={startAddAddress}>{addresses.length ? "Add another address" : "Add address"}</button>
            ) : (
                <div className="address-form">
                    <label>Full name<input value={addressForm.full_name} onChange={(event) => setAddressForm((current) => ({ ...current, full_name: event.target.value }))} /></label>
                    <label>Address<input value={addressForm.address_line} onChange={(event) => setAddressForm((current) => ({ ...current, address_line: event.target.value }))} placeholder="House, road, area" /></label>
                    <div className="profile-form-grid">
                        <label>City<input value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} /></label>
                        <label>Postal code<input value={addressForm.postal_code} onChange={(event) => setAddressForm((current) => ({ ...current, postal_code: event.target.value }))} /></label>
                    </div>
                    <label>Country<input value={addressForm.country} onChange={(event) => setAddressForm((current) => ({ ...current, country: event.target.value }))} /></label>
                    {addressError && <small role="alert">{addressError}</small>}
                    <div className="address-actions">
                        <button type="button" className="address-btn primary" onClick={saveAddress} disabled={addressSaving}>{addressSaving ? "Saving..." : addressForm.id ? "Save address" : "Add address"}</button>
                        <button type="button" className="address-btn" onClick={resetAddressForm}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    </div>;
}

function Orders({ orders }) {
    if (!orders.length) return <div className="account-empty"><FaBoxOpen /><h3>No orders yet</h3><p>Your next favorite piece belongs here.</p><Link href="/shop" className="account-link">Start shopping <FaArrowRight /></Link></div>;
    return <div className="orders-list">{orders.map((order) => <article className="order-item" key={order.id}>
        <div className="order-top"><div><span className="order-label">Order #{order.id}</span><time>{new Date(order.created_at).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}</time></div><span className={`order-status ${String(order.status).toLowerCase()}`}>{order.status}</span></div>
        <div className="order-products">{(order.items || []).map((item) => <div className="order-product" key={item.id}><div><strong>{item.title}</strong><span>Qty {item.qty}</span></div><b>{formatTk(item.totalPrice)} Tk</b></div>)}</div>
        <div className="order-total"><span>{order.shipping_address || "Delivery address on file"}<small>Shipping: {formatTk(order.shipping_fee)} Tk · Payment: {order.payment_status || "—"}</small></span><strong>{formatTk(order.total_amount)} Tk</strong></div>
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
        const loadOrders = () => {
            setOrdersLoading(true);
            api.get("api/account/orders")
                .then((response) => setOrders(normalizeOrders(unwrapList(response, ["orders"]))))
                .catch(() => notify.error("Could not load your orders."))
                .finally(() => setOrdersLoading(false));
        };
        loadOrders();
        window.addEventListener("order-created", loadOrders);
        return () => window.removeEventListener("order-created", loadOrders);
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

function ChangePasswordForm() {
    const { changePassword } = useAuth();
    const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [loading, setLoading] = useState(false);
    const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    const submit = async (event) => {
        event.preventDefault();
        if (form.newPassword.length < 6) {
            notify.error("New password must be at least 6 characters.", "Password Too Short");
            return;
        }
        if (form.newPassword !== form.confirmPassword) {
            notify.error("New password and confirm password do not match.", "Passwords Do Not Match");
            return;
        }
        if (form.newPassword === form.currentPassword) {
            notify.error("New password must be different from current password.", "Same Password");
            return;
        }
        setLoading(true);
        try {
            await changePassword(form);
            setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            notify.success("Password changed successfully.", "Password Updated!");
        } catch (error) {
            notify.error(error?.message || "Could not change your password.", "Password Change Failed");
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="account-form account-form--nested">
            <div className="profile-form-grid">
                <label>Current password<div className="password-input"><input type="password" name="currentPassword" value={form.currentPassword} onChange={change} required autoComplete="current-password" /></div></label>
                <span />
                <PasswordField label="New password" name="newPassword" value={form.newPassword} onChange={change} />
                <PasswordField label="Confirm new password" name="confirmPassword" value={form.confirmPassword} onChange={change} />
            </div>
            <button className="account-submit compact" type="button" onClick={submit} disabled={loading}>{loading ? "Updating..." : "Update password"}<FaCheck /></button>
        </div>
    );
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
        const loadProfile = () => {
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
        };
        loadProfile();
        window.addEventListener("address-changed", loadProfile);
        return () => { alive = false; window.removeEventListener("address-changed", loadProfile); };
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
                            <DashStat value={stats.delivered_orders ?? 0} label="Delivered Orders" />
                        </div>

                        <nav className="dash-card dash-nav-card" aria-label="Account navigation">
                            <DashNavItem href="/user" icon={<FaUser />} label="Profile Info" active={pathname === "/user"} />
                            <DashNavItem href="/user/orders" icon={<FaBoxOpen />} label="My Orders" active={pathname === "/user/orders"} />
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
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, per_page: 10, total: 0, total_pages: 0, has_more: false });
    useEffect(() => {
        if (!isAuthenticated) return;
        const loadOrders = () => {
            setOrdersLoading(true);
            setOrdersError("");
            const params = { page, per_page: 10 };
            if (status) params.status = status;
            api.get("api/account/orders", { params })
                .then((response) => {
                    setOrders(normalizeOrders(unwrapList(response, ["orders"])));
                    const payload = response?.data ?? response;
                    if (payload?.meta) setMeta(payload.meta);
                })
                .catch((error) => setOrdersError(error?.message || "Your order history is temporarily unavailable."))
                .finally(() => setOrdersLoading(false));
        };
        loadOrders();
        window.addEventListener("order-created", loadOrders);
        return () => window.removeEventListener("order-created", loadOrders);
    }, [isAuthenticated, status, page]);
    const statuses = ["", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    return <AccountGuard>
        <section className="account-section"><div className="section-kicker">Your purchases</div><h2>Order history</h2>
            <div className="orders-filter">
                <label>Status
                    <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                        <option value="">All</option>
                        {statuses.slice(1).map((value) => (
                            <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>
                        ))}
                    </select>
                </label>
            </div>
            {ordersLoading ? (
                <div className="account-loading">Loading orders...</div>
            ) : ordersError ? (
                <div className="account-empty"><FaBoxOpen /><h3>Orders unavailable</h3><p>{ordersError}</p></div>
            ) : (
                <>
                    <Orders orders={orders} />
                    {meta.total_pages > 1 && (
                        <div className="orders-pagination">
                            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                            <span>Page {meta.current_page} of {meta.total_pages} ({meta.total} orders)</span>
                            <button type="button" disabled={!meta.has_more} onClick={() => setPage((p) => p + 1)}>Next</button>
                        </div>
                    )}
                </>
            )}
        </section>
    </AccountGuard>;
}

export function ForgotPasswordPage() {
    const { forgotPassword } = useAuth();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const response = await forgotPassword(email.trim());
            notify.success(response?.message || "If that email exists, a reset link has been sent.", "Check Your Email!");
            setEmail("");
        } catch (error) {
            notify.error(error?.message || "Could not send the reset link.", "Request Failed");
        } finally {
            setLoading(false);
        }
    };
    return (
        <RequireNoAuth>
            <AccountFrame eyebrow="Eyara account" title="Forgot password">
                <div className="account-auth-grid">
                    <div className="account-copy">
                        <p>Enter your account email and we will send a reset link.</p>
                        <div className="account-note"><FaCheck /> Link expires in 30 minutes</div>
                        <div className="account-note"><FaCheck /> Same message even if the email is unknown</div>
                    </div>
                    <form className="account-form" onSubmit={submit}>
                        <label>Email address<input type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
                        <button className="account-submit" type="submit" disabled={loading}>{loading ? "Sending..." : "Send reset link"}<FaArrowRight /></button>
                        <p className="account-switch">Remembered it? <Link href="/login">Back to login</Link></p>
                    </form>
                </div>
            </AccountFrame>
        </RequireNoAuth>
    );
}

export function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { resetPassword } = useAuth();
    const token = searchParams?.get("token") || "";
    const [form, setForm] = useState({ password: "", confirmPassword: "" });
    const [loading, setLoading] = useState(false);
    const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    const submit = async (event) => {
        event.preventDefault();
        if (!token) {
            notify.error("Reset token is required.", "Missing Token");
            return;
        }
        if (form.password.length < 6) {
            notify.error("Password must be at least 6 characters.", "Password Too Short");
            return;
        }
        if (form.password !== form.confirmPassword) {
            notify.error("Password and confirm password do not match.", "Passwords Do Not Match");
            return;
        }
        setLoading(true);
        try {
            await resetPassword({ token, password: form.password, confirmPassword: form.confirmPassword });
            notify.success("Password reset successfully. You can now log in.", "Password Reset!");
            router.push("/login");
        } catch (error) {
            notify.error(error?.message || "Could not reset your password.", "Reset Failed");
        } finally {
            setLoading(false);
        }
    };
    return (
        <RequireNoAuth>
            <AccountFrame eyebrow="Eyara account" title="Reset password">
                <div className="account-auth-grid">
                    <div className="account-copy">
                        <p>Choose a new password for your account.</p>
                        <div className="account-note"><FaCheck /> Minimum 6 characters</div>
                        <div className="account-note"><FaCheck /> Reset links are single-use</div>
                    </div>
                    <form className="account-form" onSubmit={submit}>
                        {!token && <div className="account-empty"><h3>Missing reset token</h3><p>Open the link from your email again.</p></div>}
                        <PasswordField label="New password" name="password" value={form.password} onChange={change} />
                        <PasswordField label="Confirm new password" name="confirmPassword" value={form.confirmPassword} onChange={change} />
                        <button className="account-submit" type="submit" disabled={loading || !token}>{loading ? "Resetting..." : "Reset password"}<FaArrowRight /></button>
                        <p className="account-switch"><Link href="/forgot-password">Request a new link</Link></p>
                    </form>
                </div>
            </AccountFrame>
        </RequireNoAuth>
    );
}
