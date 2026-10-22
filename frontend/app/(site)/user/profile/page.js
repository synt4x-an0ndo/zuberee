"use client";

import { useEffect, useRef, useState } from "react";
import { FiCamera, FiEdit2, FiMapPin, FiPlus, FiTrash2 } from "react-icons/fi";
import RoleBadges from "@/components/RoleBadges";
import UserAvatar from "@/components/UserAvatar";
import PasswordInput from "@/components/PasswordInput";
import { Button, Card, CardHeader, EmptyState, Field, Input, Modal } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { api, isValidBdPhone, normalizePhone } from "@/lib/api";
import { DISTRICTS } from "@/lib/districts";

const EMPTY_ADDRESS = { fullName: "", phone: "", addressLine: "", city: "", postalCode: "", country: "Bangladesh" };

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { toast, confirm } = useFeedback();

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <div>
        <p className="eyebrow">Account</p>
        <h1>Profile & addresses</h1>
      </div>
      <PersonalCard user={user} refresh={refresh} toast={toast} confirm={confirm} />
      <AddressCard user={user} refresh={refresh} toast={toast} confirm={confirm} />
      <PasswordCard toast={toast} />
    </div>
  );
}

function PersonalCard({ user, refresh, toast, confirm }) {
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef(null);

  const save = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Please enter your name.");
    if (form.phone && !isValidBdPhone(form.phone)) return setError("Enter a valid Bangladeshi mobile number.");
    setBusy(true);
    try {
      await api.put("api/account/profile", { name: form.name.trim(), phone: form.phone ? normalizePhone(form.phone) : "" });
      await refresh();
      toast.success("Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };


  const removePhoto = async () => {
    const approved = await confirm({
      title: "Remove profile photo?",
      message: "Your profile will return to the default account image.",
      confirmText: "Remove photo",
      danger: true,
    });
    if (!approved) return;
    setRemovingPhoto(true);
    try {
      await api.delete("api/account/avatar");
      await refresh();
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Images must be under 2 MB.");
    const data = new FormData();
    data.append("image", file);
    setUploadingPhoto(true);
    try {
      await api.upload("api/account/upload-avatar", data);
      await refresh();
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader title="Personal details" subtitle={user?.email} />
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <div className="avatar avatar-lg" style={{ position: "relative", width: 84, height: 84 }}>
          <UserAvatar image={user?.image} alt="Profile photo" fill sizes="84px" />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Button variant="outline" size="sm" loading={removingPhoto} disabled={removingPhoto} onClick={removePhoto}>
            <FiTrash2 aria-hidden="true" /> Remove photo
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => uploadPhoto(event.target.files?.[0])} />
          <Button variant="outline" size="sm" loading={uploadingPhoto} disabled={uploadingPhoto} onClick={() => fileRef.current?.click()}>
            <FiCamera aria-hidden="true" /> Change photo
          </Button>
        </div>
        <RoleBadges roles={user?.roles} className="profile-role-badges" />
      </div>
      <form onSubmit={save} className="stack" noValidate>
        {error && <p className="notice notice-danger" role="alert">{error}</p>}
        <div className="form-grid">
          <Field label="Full name" htmlFor="pf-name" required>
            <Input id="pf-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Mobile number" htmlFor="pf-phone" hint="Used for delivery updates.">
            <Input id="pf-phone" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <div>
          <Button type="submit" variant="primary" loading={busy} disabled={busy}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}

function AddressCard({ user, refresh, toast, confirm }) {
  /**
   * The profile payload embeds addresses[], but GET /api/account/addresses returns the same rows on
   * their own, so the list is kept in local state and reloaded from that endpoint after every change.
   * (Falls back to a full profile refresh when the address call fails.)
   */
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [editing, setEditing] = useState(null); // null | { id?, ...fields }
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Array.isArray(user?.addresses)) setAddresses(user.addresses);
  }, [user]);

  const loadAddresses = async () => {
    try {
      const body = await api.get("api/account/addresses");
      const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : null;
      if (rows) {
        setAddresses(rows);
        return;
      }
    } catch {
      /* fall through to the full profile refresh */
    }
    await refresh();
  };

  const open = (address) => {
    setErrors({});
    setForm(address ? { ...EMPTY_ADDRESS, ...address } : EMPTY_ADDRESS);
    setEditing(address || {});
  };

  const save = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Enter the recipient's name.";
    if (!isValidBdPhone(form.phone)) next.phone = "Enter a valid mobile number.";
    if (form.addressLine.trim().length < 5) next.addressLine = "Enter the street address.";
    if (!form.city.trim()) next.city = "Enter the city or district.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      fullName: form.fullName.trim(),
      phone: normalizePhone(form.phone),
      addressLine: form.addressLine.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim() || "Bangladesh",
    };
    setBusy(true);
    try {
      if (editing?.id) await api.put(`api/account/addresses/${editing.id}`, body);
      else await api.post("api/account/addresses", body);
      await loadAddresses();
      toast.success(editing?.id ? "Address updated." : "Address added.");
      setEditing(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address) => {
    const ok = await confirm({ title: "Delete this address?", message: `${address.addressLine}, ${address.city}`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`api/account/addresses/${address.id}`);
      await loadAddresses();
      toast.success("Address removed.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Card>
      <CardHeader
        title="Saved addresses"
        subtitle="Choose one of these at checkout."
        actions={<Button size="sm" variant="primary" onClick={() => open(null)}><FiPlus aria-hidden="true" /> Add address</Button>}
      />
      {addresses.length === 0 ? (
        <EmptyState icon={FiMapPin} title="No saved addresses" text="Add one to make checkout faster." />
      ) : (
        <div className="address-grid stagger">
          {addresses.map((a) => (
            <article key={a.id} className="address-card">
              <strong>{a.fullName}</strong>
              <span className="muted num" style={{ fontSize: "0.9rem" }}>{a.phone}</span>
              <p style={{ margin: "6px 0 0", color: "var(--ink-2)" }}>
                {[a.addressLine, a.city, a.postalCode, a.country].filter(Boolean).join(", ")}
              </p>
              <div className="card-actions">
                <Button size="sm" variant="ghost" onClick={() => open(a)}><FiEdit2 aria-hidden="true" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a)}><FiTrash2 aria-hidden="true" /> Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit address" : "Add address"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={save}>Save address</Button>
          </>
        }
      >
        <form onSubmit={save} className="stack" noValidate>
          <div className="form-grid">
            <Field label="Recipient name" htmlFor="ad-name" required error={errors.fullName}>
              <Input id="ad-name" value={form.fullName} onChange={set("fullName")} aria-invalid={!!errors.fullName} />
            </Field>
            <Field label="Mobile number" htmlFor="ad-phone" required error={errors.phone}>
              <Input id="ad-phone" inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
            </Field>
          </div>
          <Field label="Street address" htmlFor="ad-line" required error={errors.addressLine} hint="House, road, area and landmark.">
            <Input id="ad-line" value={form.addressLine} onChange={set("addressLine")} aria-invalid={!!errors.addressLine} />
          </Field>
          <div className="form-grid">
            <Field label="City / district" htmlFor="ad-city" required error={errors.city}>
              <Input id="ad-city" list="ad-districts" value={form.city} onChange={set("city")} aria-invalid={!!errors.city} />
              <datalist id="ad-districts">
                {DISTRICTS.map((d) => <option key={d.value} value={d.label} />)}
              </datalist>
            </Field>
            <Field label="Postal code" htmlFor="ad-postal">
              <Input id="ad-postal" inputMode="numeric" value={form.postalCode} onChange={set("postalCode")} />
            </Field>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function PasswordCard({ toast }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.newPassword.length < 8) return setError("The new password needs at least 8 characters.");
    if (form.newPassword !== form.confirmPassword) return setError("The new passwords do not match.");
    setBusy(true);
    try {
      await api.put("api/account/change-password", form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" />
      <form onSubmit={submit} className="stack" noValidate style={{ maxWidth: 520 }}>
        {error && <p className="notice notice-danger" role="alert">{error}</p>}
        <Field label="Current password" htmlFor="pw-current" required>
          <PasswordInput id="pw-current" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" htmlFor="pw-new" required hint="At least 8 characters.">
          <PasswordInput id="pw-new" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" required>
          <PasswordInput id="pw-confirm" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        </Field>
        <div>
          <Button type="submit" variant="primary" loading={busy} disabled={busy}>Update password</Button>
        </div>
      </form>
    </Card>
  );
}
