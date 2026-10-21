"use client";

import { useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, Select, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { slugify } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const SIZE_GUIDE = [
  { value: "NONE", label: "No size guide" },
  { value: "DRESS", label: "Dress Size Guide" },
  { value: "SHOE", label: "Shoe Size Guide" },
];

const GUIDE_LABEL = { SHOE: "shoe", DRESS: "dress" };

const blank = { id: null, name: "", slug: "", slugTouched: false, description: "", parentId: "", displayPriority: 0, showOnHomepage: false, stockTracking: false, sizeGuideType: "NONE" };

function categoryRowsFrom(response) {
  const candidates = [response?.data?.categories, response?.categories, response?.data, response];
  return candidates.find(Array.isArray) || [];
}
function categorySubtreeInfo(row, rows) {
  const subtreeIds = new Set([String(row.id)]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const candidate of rows || []) {
      const candidateParentId = candidate.parentId ?? candidate.parent_id ?? null;
      if (candidateParentId !== null && subtreeIds.has(String(candidateParentId)) && !subtreeIds.has(String(candidate.id))) {
        subtreeIds.add(String(candidate.id));
        expanded = true;
      }
    }
  }

  return {
    productCount: (rows || []).reduce(
      (total, candidate) => total + (subtreeIds.has(String(candidate.id)) ? Number(candidate._count?.products || 0) : 0),
      0
    ),
    subCategoryCount: subtreeIds.size - 1,
  };
}

function rootDeleteBlockMessage(row, rows) {
  const parentId = row.parentId ?? row.parent_id ?? null;
  if (parentId !== null) return "";

  const { productCount, subCategoryCount } = categorySubtreeInfo(row, rows);
  if (!productCount && !subCategoryCount) return "";

  return `You cannot delete '${row.name}' because it contains products and sub-categories. Please move the products to another category and delete the sub-categories first, or change the category status to Inactive.`;
}

function hardDeleteMessage(name, productCount, subCategoryCount) {
  const productNoun = productCount === 1 ? "product" : "products";
  const nestedText = subCategoryCount
    ? `, its ${subCategoryCount} nested sub-categor${subCategoryCount === 1 ? "y" : "ies"},`
    : "";
  return `Sub-category '${name}' contains ${productCount} ${productNoun}. Warning: This will permanently delete '${name}'${nestedText} and all ${productCount} ${productNoun} associated with it. This action cannot be undone. Do you want to proceed?`;
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
  const [query, setQuery] = useState("");

  const { data, loading, error, reload } = useAsync(() => api.get("api/categories", { auth: false }).then(categoryRowsFrom), []);
  const flat = useMemo(() => (data ? buildFlat(data) : []), [data]);
  const byId = useMemo(() => new Map((data || []).map((r) => [String(r.id), r])), [data]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return flat;
    return flat.filter((row) => {
      const parent = row.parentId != null ? byId.get(String(row.parentId)) : null;
      return [row.name, row.slug, parent?.name].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [flat, query, byId]);

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
    const isRoot = (row.parentId ?? row.parent_id ?? null) === null;
    const { productCount, subCategoryCount } = categorySubtreeInfo(row, data);
    const failureMessage = `Failed to delete '${row.name}'. Please try again or check whether this category is being used elsewhere.`;
    const blockedMessage = rootDeleteBlockMessage(row, data);
    if (blockedMessage) {
      toast.error(blockedMessage);
      return;
    }

    const confirmHardDelete = (count, nestedCount) => confirm({
      title: "Delete Sub-Category?",
      message: hardDeleteMessage(row.name, count, nestedCount),
      confirmText: "Hard Delete",
      cancelText: "Cancel",
      danger: true,
    });

    const hardDelete = !isRoot && productCount > 0;
    if (hardDelete) {
      const ok = await confirmHardDelete(productCount, subCategoryCount);
      if (!ok) return;
    } else {
      const normalMessage = !isRoot && subCategoryCount > 0
        ? `"${row.name}" and its ${subCategoryCount} nested sub-categor${subCategoryCount === 1 ? "y" : "ies"} will be removed.`
        : `"${row.name}" will be removed.`;
      const ok = await confirm({ title: "Delete this category?", message: normalMessage, confirmText: "Delete", cancelText: "Cancel", danger: true });
      if (!ok) return;
    }

    try {
      const response = await api.delete(
        `api/categories/${row.id}`,
        hardDelete ? { params: { hardDelete: true } } : undefined
      );
      toast.success(
        response?.message ||
          (hardDelete
            ? `Sub-category '${row.name}' and its associated records have been deleted successfully.`
            : isRoot
              ? "Category deleted."
              : `Sub-category '${row.name}' has been deleted successfully.`)
      );
      reload();
    } catch (err) {
      const code = err?.data?.code;
      if (code === "ROOT_CATEGORY_DELETE_BLOCKED") {
        toast.error(err.message);
        return;
      }

      // If products were added after the table loaded, the backend asks for
      // the same explicit hard-delete confirmation before anything is removed.
      if (!hardDelete && code === "HARD_DELETE_CONFIRMATION_REQUIRED") {
        const freshProductCount = Number(err?.data?.data?.productCount) || productCount;
        const freshSubCategoryCount = Number(err?.data?.data?.subCategoryCount) || subCategoryCount;
        const ok = await confirmHardDelete(freshProductCount, freshSubCategoryCount);
        if (!ok) return;
        try {
          const retryResponse = await api.delete(`api/categories/${row.id}`, { params: { hardDelete: true } });
          toast.success(
            retryResponse?.message ||
              `Sub-category '${row.name}' and its associated records have been deleted successfully.`
          );
          reload();
        } catch (retryErr) {
          if (retryErr?.data?.code === "ROOT_CATEGORY_DELETE_BLOCKED") toast.error(retryErr.message);
          else toast.error(failureMessage);
        }
        return;
      }

      toast.error(failureMessage);
    }
  };

  const parentOptions = (data || []).filter((c) => String(c.id) !== String(form.id)).map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Catalogue" title="Categories" subtitle="Organise products into collections and sub-collections." actions={<Button variant="primary" onClick={() => open(null)}><FiPlus aria-hidden="true" /> Add Category</Button>} />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 300 }} /> : flat.length === 0 ? (
        <EmptyState title="No categories yet" text="Create your first collection to start organising products." action={<Button variant="primary" onClick={() => open(null)}>Create category</Button>} />
      ) : (
        <>
          <Card>
            <div className="card-pad categories-toolbar">
              <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 620 }}>
                <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 15, color: "var(--muted)" }} />
                <Input id="cat-search" type="search" aria-label="Search categories" placeholder="Search categories by name..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 36 }} />
              </div>
              <span className="categories-total">
                Total: <strong>{flat.length}</strong> categories{query.trim() && <span> · {filtered.length} shown</span>}
              </span>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState title="No categories match" text={`Nothing matches "${query.trim()}". Try a different search.`} />
          ) : (
            <DataTable>
              <thead>
                <tr><th>#</th><th>Name</th><th>Slug</th><th>Parent</th><th>Size Guide Type</th><th>Stock</th><th>Home</th><th>Priority</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const parent = row.parentId != null ? byId.get(String(row.parentId)) : null;
                  return (
                    <tr key={row.id}>
                      <td className="muted num">{i + 1}</td>
                      <td><strong>{row.name}</strong></td>
                      <td><code className="category-slug">{row.slug}</code></td>
                      <td>{parent ? <Badge tone="warn">{parent.name}</Badge> : <span className="muted">Root</span>}</td>
                      <td>{row.sizeGuideType && row.sizeGuideType !== "NONE" ? GUIDE_LABEL[row.sizeGuideType] || row.sizeGuideType.toLowerCase() : <span className="muted">—</span>}</td>
                      <td>{row.stockTracking ? <Badge tone="success">Tracked</Badge> : <Badge tone="neutral">Off</Badge>}</td>
                      <td>{row.showOnHomepage ? <Badge tone="info">On</Badge> : <Badge tone="neutral">Off</Badge>}</td>
                      <td className="num">{row.displayPriority ?? 0}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button size="sm" variant="outline" onClick={() => open(row)} aria-label={`Edit ${row.name}`}><FiEdit2 aria-hidden="true" /> Edit</Button>
                          <Button size="sm" variant="danger-outline" onClick={() => remove(row)} aria-label={`Delete ${row.name}`}><FiTrash2 aria-hidden="true" /> Delete</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </>
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
            <Field label="Priority" htmlFor="c-order" hint="Lower numbers appear first.">
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
