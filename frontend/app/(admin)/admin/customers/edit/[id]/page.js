"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

/**
 * Edit customer (/dashboard/customers/edit/{id})
 *  - GET api/customer-profiles/{id}
 *  - PUT api/customer-profiles/{id} {name, phone, email|null,
 *          badge_title|null, password?}
 */
function EditCustomer({ id }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    badge_title: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`api/customer-profiles/${id}`);
        const c = r?.data?.data || r?.data || r;
        if (!alive) return;
        setForm({
          name: c.name || "",
          phone: c.phone || "",
          email: c.email || "",
          password: "",
          badge_title: c.assigned_badge?.title || c.badge_title || "",
        });
        setHasAccount(!!c.has_user_account);
      } catch {
        if (alive) notify.error("Customer not found");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        badge_title: form.badge_title || null,
      };
      if (form.password) body.password = form.password;
      await api.put(`api/customer-profiles/${id}`, body);
      notify.success("Customer updated successfully");
      window.location.href = "/admin/customers";
    } catch (err) {
      notify.error(err.message || "Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0 fw-bold">Edit Customer</h4>
          <Link href="/admin/customers" className="btn btn-sm btn-outline-secondary">
            Cancel
          </Link>
        </div>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Phone</label>
                <input
                  className="form-control"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Badge</label>
                <input
                  className="form-control"
                  placeholder="No badge"
                  value={form.badge_title}
                  onChange={(e) => set("badge_title", e.target.value)}
                />
              </div>
              {hasAccount && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Leave blank to keep current password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </div>
              )}
              <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerEditPage({ params }) {
  const { id } = use(params);
  return (
    <PageGate permission="view customers">
      <EditCustomer id={id} />
    </PageGate>
  );
}
