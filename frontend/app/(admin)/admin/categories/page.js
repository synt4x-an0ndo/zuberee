"use client";

import { useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { slugify } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const SIZE_GUIDE = [
  { value: "NONE", label: "No size guide" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "FOOTWEAR", label: "Footwear" },
];

const blank = { id: null, name: "", slug: "", slugTouched: false, description: "", parentId: "", displayPriority: 0, showOnHomepage: false, stockTracking: false, sizeGuideType: "NONE" };

function categoryRowsFrom(response) {
  const candidates = [response?.data?.categories, response?.categories, response?.data, response];
  return candidates.find(Array.isArray) || [];
}
function buildFlat(rows) {
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const depthOf = (row, seen = new Set()) => {
    const parent = row.parentId ?? row.parent_id ?? null;
    if (parent == null || seen.has(String(row.id)) || !byId.has(String(parent))) return 0;
    seen.add(String(row.id));
    return 1 + depthOf(byId.get(String(parent)), seen);
  };
  const sorted = [...rows].sort((a, b) => (a.displayPriority ?? 0) - (b.displayPriority ?? 0) || String(a.name).localeCompare(String(b.name)));
  return sorted.map((r) => ({ ...r, depth: depthOf(r) }));
}

export default function CategoriesPage() {
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(() => api.get("api/categories", { auth: false }).then(categoryRowsFrom), []);
  const flat = useMemo(() => (data ? buildFlat(data) : []), [data]);

  /**
   * Editing re-reads the single category (GET /api/categories/:id, public) so a stale list row can
   * never overwrite newer values; the list row is used as the fallback when the call fails.
   */
  const open = async (row) => {
    setErrors({});
    if (!row) {
      setEditing({});
      setForm(blank);
      return;
    }
    let fresh = row;
    try {
      const body = await api.get(`api/categories/${row.id}`, { auth: false });
      if (body?.data) fresh = { ...row, ...body.data };
    } catch {
      /* keep the row from the list */
    }
    setEditing(fresh);
    setForm({
      id: fresh.id,
      name: fresh.name || "",
      slug: fresh.slug || "",
      slugTouched: true,
      description: fresh.description || "",
      parentId: fresh.parentId ?? fresh.parent_id ?? "",
      displayPriority: fresh.displayPriority ?? 0,
      showOnHomepage: Boolean(fresh.showOnHomepage),
      stockTracking: Boolean(fresh.stockTracking),
      sizeGuideType: fresh.sizeGuideType || "NONE",
    });
  };

  const set = (key) => (e) => {
    const value = e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && !f.slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  const save = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter a category name.";
    if (!slugify(form.slug)) next.slug = "Enter a valid slug.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = {
      name: form.name.trim(),
      slug: slugify(form.slug),
      description: form.description.trim(),
      parentId: form.parentId ? Number(form.parentId) : null,
      displayPriority: Number(form.displayPriority) || 0,
      showOnHomepage: form.showOnHomepage,
      stockTracking: form.stockTracking,
      sizeGuideType: form.sizeGuideType,
    };
    setBusy(true);
    try {
      if (form.id) await api.put(`api/categories/${form.id}`, body);
      else await api.post("api/categories", body);
      toast.success(form.id ? "Category updated." : "Category created.");
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({ title: "Delete this category?", message: `"${row.name}" will be removed. Categories with products cannot be deleted.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`api/categories/${row.id}`);
      toast.success("Category deleted.");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const parentOptions = (data || []).filter((c) => String(c.id) !== String(form.id)).map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Catalogue" title="Categories" subtitle="Organise products into collections and sub-collections." actions={<Button variant="primary" onClick={() => open(null)}><FiPlus aria-hidden="true" /> New category</Button>} />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 300 }} /> : flat.length === 0 ? (
        <EmptyState title="No categories yet" text="Create your first collection to start organising products." action={<Button variant="primary" onClick={() => open(null)}>Create category</Button>} />
      ) : (
        <DataTable>
          <thead>
            <tr><th>Name</th><th>Slug</th><th className="text-right">Order</th><th>Homepage</th><th /></tr>
          </thead>
          <tbody>
            {flat.map((row) => (
              <tr key={row.id}>
                <td><span style={{ paddingLeft: row.depth * 22 }}>{row.depth > 0 && <span className="muted" aria-hidden="true">↳ </span>}<strong>{row.name}</strong></span></td>
                <td className="muted num">{row.slug}</td>
                <td className="text-right num">{row.displayPriority ?? 0}</td>
                <td>{row.showOnHomepage ? <Badge tone="success">Shown</Badge> : <Badge tone="neutral">Hidden</Badge>}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button type="button" className="icon-btn" aria-label={`Edit ${row.name}`} onClick={() => open(row)}><FiEdit2 aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={`Delete ${row.name}`} onClick={() => remove(row)}><FiTrash2 aria-hidden="true" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={form.id ? "Edit category" : "New category"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}
      >
        <form onSubmit={save} className="stack" noValidate>
          <Field label="Name" htmlFor="c-name" required error={errors.name}>
            <Input id="c-name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Slug" htmlFor="c-slug" required error={errors.slug} hint="Used in the web address, e.g. /kurti">
            <Input id="c-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))} aria-invalid={!!errors.slug} />
          </Field>
          <Field label="Parent category" htmlFor="c-parent">
            <Select id="c-parent" placeholder="None (top level)" value={form.parentId} onChange={set("parentId")} options={parentOptions} />
          </Field>
          <Field label="Description" htmlFor="c-desc">
            <Input id="c-desc" value={form.description} onChange={set("description")} />
          </Field>
          <div className="form-grid">
            <Field label="Display order" htmlFor="c-order" hint="Lower numbers appear first.">
              <Input id="c-order" type="number" min="0" value={form.displayPriority} onChange={set("displayPriority")} />
            </Field>
            <Field label="Size guide" htmlFor="c-guide">
              <Select id="c-guide" value={form.sizeGuideType} onChange={set("sizeGuideType")} options={SIZE_GUIDE} />
            </Field>
          </div>
          <Toggle checked={form.showOnHomepage} onChange={(v) => setForm((f) => ({ ...f, showOnHomepage: v }))} label="Show on the homepage" />
          <Toggle checked={form.stockTracking} onChange={(v) => setForm((f) => ({ ...f, stockTracking: v }))} label="Track stock for this category" />
        </form>
      </Modal>
    </div>
  );
}
