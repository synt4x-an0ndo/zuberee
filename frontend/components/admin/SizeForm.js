"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import notify from "@/components/notify";

/**
 * Admin Size create / edit form.
 *  - POST api/admin/sizes     { size, position?, isActive? }  (create)
 *  - PUT  api/admin/sizes/:id { size?, position?, isActive? } (edit)
 * The single-size read reuses GET api/admin/sizes (no dedicated GET-by-id route).
 */
export default function SizeForm({ id }) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ size: "", position: "", isActive: true });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return undefined;
    let alive = true;
    (async () => {
      try {
        const r = await api.get("api/admin/sizes");
        const list = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
        const found = list.find((s) => String(s.id) === String(id));
        if (!alive) return;
        if (found) {
          setForm({
            size: found.size ?? "",
            position: found.position ?? "",
            isActive: found.is_active ?? true,
          });
        } else {
          notify.error("Size not found.");
        }
      } catch (e) {
        if (alive) notify.error(e.message || "Failed to load size");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.size.trim()) return notify.error("Size is required.");
    setSaving(true);
    try {
      const payload = {
        size: form.size.trim(),
        ...(form.position !== "" ? { position: Number(form.position) } : {}),
        isActive: Boolean(form.isActive),
      };
      if (isEdit) {
        await api.put(`api/admin/sizes/${id}`, payload);
        notify.success("Size updated successfully.");
      } else {
        await api.post("api/admin/sizes", payload);
        notify.success("Size created successfully.");
      }
      router.push("/admin/sizes");
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
          <h4 className="mb-0 fw-bold">{isEdit ? "Edit Size" : "Add Size"}</h4>
          <Link href="/admin/sizes" className="btn btn-sm btn-outline-secondary">
            ← Back
          </Link>
        </div>
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            {loading ? (
              <div className="text-center py-4">
                <span className="spinner-border spinner-border-sm" />
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Size</label>
                  <input
                    className="form-control"
                    value={form.size}
                    onChange={(e) => set("size", e.target.value)}
                    placeholder="e.g. M, L, XL"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Position (optional)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.position}
                    onChange={(e) => set("position", e.target.value)}
                    placeholder="Display order"
                  />
                </div>
                <div className="form-check mb-3">
                  <input
                    id="size-active"
                    type="checkbox"
                    className="form-check-input"
                    checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="size-active">
                    Active
                  </label>
                </div>
                <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                  {saving ? "Saving..." : isEdit ? "Update Size" : "Create Size"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
