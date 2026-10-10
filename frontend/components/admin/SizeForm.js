"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";

/**
 * Add/edit size form.
 *  create: POST   api/sizes   {size}
 *  edit:   GET    api/sizes/{id}   +   PUT api/sizes/{id}
 */
export default function SizeForm({ id, initial }) {
  const [name, setName] = useState(initial?.size || "");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return notify.error("Size name is required");
    setSaving(true);
    try {
      if (id) {
        await api.put(`api/sizes/${id}`, { size: name.trim() });
        notify.success("Size updated");
      } else {
        await api.post("api/sizes", { size: name.trim() });
        notify.success("Size created");
      }
      window.location.href = "/admin/sizes";
    } catch (err) {
      notify.error(err.message || "Failed to save size");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0 fw-bold">{id ? "Edit Size" : "Add Size"}</h4>
          <Link href="/admin/sizes" className="btn btn-sm btn-outline-secondary">
            ← Back
          </Link>
        </div>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              <label className="form-label fw-semibold">Size Name</label>
              <input
                className="form-control mb-3"
                placeholder='e.g. "UK 6" or "M"'
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                {saving ? "Saving..." : id ? "Update Size" : "Create Size"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
