"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

/** Flatten the category tree into level-indented options. */
function flatten(nodes, level = 0, out = []) {
  (nodes || []).forEach((n) => {
    out.push({ ...n, level });
    if (n.all_children?.length) flatten(n.all_children, level + 1, out);
  });
  return out;
}

/**
 * Shared create/edit form for collections (categories).
 *  - list : GET    api/frontend/categories
 *  - save : POST   api/categories                      (create)
 *           PUT    api/categories/{id}                 (update,
 *             incl. apply_tracking_to_products flag)
 */
export default function CategoryForm({ initial, id, permissionExtra }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: "",
    parent_id: "",
    home_category: "0",
    priority: 0,
    size_guide_type: "",
    track_inventory: false,
    apply_tracking_to_products: false,
    ...(initial || {}),
  });

  useEffect(() => {
    if (initial) setForm((f) => ({ ...f, ...initial }));
  }, [initial]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get("api/frontend/categories", { auth: false });
        if (alive) setTree(Array.isArray(r) ? r : []);
      } catch {
        notify.error("Failed to load categories");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const options = flatten(tree);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Category name is required";
    else if (form.name.length > 100)
      e.name = "Category name must be less than 100 characters";
    if (Number(form.priority) < 0 || Number(form.priority) > 999)
      e.priority = "Priority must be between 0 and 999";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        home_category: form.home_category,
        priority: Number(form.priority),
        size_guide_type: form.size_guide_type || null,
        track_inventory: !!form.track_inventory,
        ...(id ? { apply_tracking_to_products: !!form.apply_tracking_to_products } : {}),
      };
      if (id) {
        await api.put(`api/categories/${id}`, payload);
        notify.success("Category updated successfully");
      } else {
        await api.post("api/categories", payload);
        notify.success("Category created successfully");
      }
      window.location.href = "/dashboard/category";
    } catch (err) {
      notify.error(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0 fw-bold">
            {id ? "Edit Category" : "Add Category"}
          </h4>
          <Link href="/dashboard/category" className="btn btn-sm btn-outline-secondary">
            ← Back to Categories
          </Link>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={submit}>
              {/* name */}
              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Category Name <span className="text-danger">*</span>
                </label>
                <input
                  className={`form-control ${errors.name ? "is-invalid" : ""}`}
                  placeholder="Enter a descriptive category name"
                  value={form.name}
                  maxLength={100}
                  onChange={(e) => set("name", e.target.value)}
                />
                {errors.name && <div className="invalid-feedback">{errors.name}</div>}
              </div>

              {/* parent */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Parent Category</label>
                <select
                  className="form-select"
                  value={form.parent_id ?? ""}
                  onChange={(e) => set("parent_id", e.target.value)}
                >
                  <option value="">-- Root Category (No Parent) --</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {"└─ ".repeat(o.level)}
                      {o.name}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  {options.length} categories loaded — choose nesting level.
                </small>
              </div>

              <div className="row">
                {/* home category */}
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Home Category</label>
                  <select
                    className="form-select"
                    value={form.home_category}
                    onChange={(e) => set("home_category", e.target.value)}
                  >
                    <option value="1">On — featured prominently on the homepage</option>
                    <option value="0">Off — appears only in category listings</option>
                  </select>
                </div>

                {/* priority */}
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Priority</label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    className={`form-control ${errors.priority ? "is-invalid" : ""}`}
                    value={form.priority}
                    onChange={(e) => set("priority", e.target.value)}
                  />
                  {errors.priority && (
                    <div className="invalid-feedback">{errors.priority}</div>
                  )}
                  <small className="text-muted">
                    Higher number = higher display priority (0-999)
                  </small>
                </div>
              </div>

              <div className="row">
                {/* size guide */}
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Size Guide Type</label>
                  <select
                    className="form-select"
                    value={form.size_guide_type ?? ""}
                    onChange={(e) => set("size_guide_type", e.target.value)}
                  >
                    <option value="">-- No Size Guide --</option>
                    <option value="shoe">Shoe Size Guide</option>
                    <option value="dress">Dress Size Guide</option>
                  </select>
                  <small className="text-muted">
                    Select size guide only if category needs sizing
                  </small>
                </div>

                {/* track inventory */}
                <div className="col-md-6 mb-3 d-flex align-items-center">
                  <label className="d-flex align-items-center gap-2 mt-4 mb-0" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!form.track_inventory}
                      onChange={(e) => set("track_inventory", e.target.checked)}
                    />
                    <span className="fw-semibold">Track inventory for this category</span>
                  </label>
                </div>
              </div>

              {/* edit-only: apply tracking to existing products */}
              {id && (
                <div className="mb-3 p-3 border rounded bg-light">
                  <label className="d-flex align-items-start gap-2 mb-0" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!form.apply_tracking_to_products}
                      onChange={(e) => set("apply_tracking_to_products", e.target.checked)}
                    />
                    <span className="small">
                      Also switch tracking on for every product already in this
                      category
                    </span>
                  </label>
                </div>
              )}

              <div className="d-flex gap-2">
                <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : id ? (
                    "Update Category"
                  ) : (
                    "Create Category"
                  )}
                </button>
                <Link href="/dashboard/category" className="btn btn-outline-secondary px-4">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
