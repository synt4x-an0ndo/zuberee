"use client";

/**
 * Edit Customer (Zuberee parity).
 *
 * Zuberee reference: GET /dashboard/customers/edit/:id — "Edit Customer" form:
 * Name, Phone, Badge (No badge / Black List Customer / Very Annoying Customer /
 * Tester / Owner / Silver Customer / Golden Customer), Email and Password
 * ("Fill email and password to create a user login for this customer.",
 * password left blank to keep the current one, minimum 6 characters).
 * Zuberee's Customers page only assigns a badge inline; it has no page to
 * edit a profile's name/phone/email or set a login password. This is that page.
 *
 * FRONTEND ONLY (backend APIs to be wired by the backend dev, no UI change needed):
 *   GET /api/admin/customer-profiles/:id  -> { data: { id, name, phone, email, badge_title, ... } }
 *   PUT /api/admin/customer-profiles/:id  <- { name, phone, email|null, badge_title|null, password? }
 * Zuberee calls the same resource without the /admin prefix
 * (GET/PUT /api/customer-profiles/:id) — either mount point works for this
 * page as long as the field names above are honoured. Note the badge values
 * here are Zuberee `badge_title` strings; the backend dev should map them to
 * whatever badge storage the Customers/Leaderboard badge flow uses.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiInfo, FiSave } from "react-icons/fi";
import PasswordInput from "@/components/PasswordInput";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Select, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

/** Badge options exactly as on the live Zuberee Edit Customer page. */
const BADGE_TITLE_OPTIONS = [
  { value: "", label: "No badge" },
  { value: "black_list_customer", label: "Black List Customer" },
  { value: "very_annoying_customer", label: "Very Annoying Customer" },
  { value: "tester", label: "Tester" },
  { value: "owner", label: "Owner" },
  { value: "silver_customer", label: "Silver Customer" },
  { value: "golden_customer", label: "Golden Customer" },
];

export default function CustomerEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setFormError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", badge_title: "", password: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = await api.get(`api/admin/customer-profiles/${id}`);
        const customer = body?.data || body || {};
        if (!alive) return;
        setForm({
          name: customer.name || "",
          phone: customer.phone || "",
          email: customer.email || "",
          badge_title: customer.badge_title || customer.assigned_badge || customer.badge || "",
          password: "",
        });
      } catch {
        if (alive) setBackendReady(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.name.trim()) return setFormError("Enter the customer's name.");
    if (!form.phone.trim()) return setFormError("Enter the customer's phone number.");
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setFormError("Enter a valid email address, or leave it blank.");
    }
    if (form.password && form.password.length < 6) {
      return setFormError("Password must be at least 6 characters, or left blank to keep the current one.");
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      badge_title: form.badge_title || null,
    };
    if (form.password) payload.password = form.password;

    setBusy(true);
    try {
      await api.put(`api/admin/customer-profiles/${id}`, payload);
      toast.success("Customer updated successfully");
      router.push("/admin/customers");
    } catch (err) {
      setFormError(err.message || "Customer could not be saved. The backend update endpoint may not be connected yet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 760 }}>
      <AdminHeader
        eyebrow="Sales"
        title="Edit Customer"
        subtitle={`Customer #${id} — profile details, badge and login.`}
        actions={
          <Button variant="ghost" href="/admin/customers">
            <FiArrowLeft aria-hidden="true" /> Customers
          </Button>
        }
      />

      {!backendReady && !loading && (
        <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
          <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Frontend only for now: customer <span className="num">#{id}</span> could not be loaded from the
            backend, so the form below starts empty. Backend dev — wire the endpoints listed in this
            file&apos;s header comment and it works unchanged.
          </span>
        </div>
      )}

      {loading ? (
        <Skeleton style={{ height: 420 }} />
      ) : (
        <Card>
          <CardHeader title="Customer details" subtitle="Name and phone are required. Everything else is optional." />
          <form onSubmit={save} className="stack" noValidate>
            {error && (
              <p className="notice notice-danger" role="alert">
                {error}
              </p>
            )}

            <div className="form-grid">
              <Field label="Name" htmlFor="customer-edit-name" required>
                <Input id="customer-edit-name" name="name" value={form.name} onChange={set("name")} />
              </Field>
              <Field label="Phone" htmlFor="customer-edit-phone" required>
                <Input id="customer-edit-phone" name="phone" value={form.phone} onChange={set("phone")} />
              </Field>
            </div>

            <Field label="Badge" htmlFor="customer-edit-badge">
              <Select id="customer-edit-badge" name="badge_title" value={form.badge_title} onChange={set("badge_title")} options={BADGE_TITLE_OPTIONS} />
            </Field>

            <div className="stack" style={{ gap: "0.75rem" }}>
              <p className="muted" style={{ margin: 0 }}>Fill email and password to create a user login for this customer.</p>
              <div className="form-grid">
                <Field label="Email" htmlFor="customer-edit-email">
                  <Input id="customer-edit-email" name="email" type="email" value={form.email} onChange={set("email")} placeholder="customer@example.com" />
                </Field>
                <Field label="Password (leave blank to keep current)" htmlFor="customer-edit-password" hint="Minimum 6 characters">
                  <PasswordInput id="customer-edit-password" name="password" autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="Minimum 6 characters" />
                </Field>
              </div>
            </div>

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Link href="/admin/customers" className="btn btn-ghost">
                Cancel
              </Link>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                <FiSave aria-hidden="true" /> {busy ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
