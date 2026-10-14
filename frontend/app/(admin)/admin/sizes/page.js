"use client";

import { useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Button, EmptyState, ErrorState, Field, Input, Modal, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

export default function SizesPage() {
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ size: "", position: 0, isActive: true });
  const [error, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, error: loadError, reload } = useAsync(() => api.get("api/admin/sizes").then((b) => (Array.isArray(b.data) ? b.data : [])), []);

  const open = (row) => {
    setFormError("");
    setEditing(row || {});
    setForm(row ? { size: row.size, position: row.position ?? 0, isActive: row.is_active !== false } : { size: "", position: (data?.length || 0) + 1, isActive: true });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.size.trim()) return setFormError("Enter a size label, e.g. M or 32.");
    setBusy(true);
    try {
      const body = { size: form.size.trim(), position: Number(form.position) || 0, isActive: form.isActive };
      if (editing?.id) await api.put(`api/admin/sizes/${editing.id}`, body);
      else await api.post("api/admin/sizes", body);
      toast.success(editing?.id ? "Size updated." : "Size added.");
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({ title: "Delete this size?", message: `"${row.size}" will no longer be offered on new products.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`api/admin/sizes/${row.id}`);
      toast.success("Size deleted.");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader title="Sizes" actions={<Button variant="primary" onClick={() => open(null)}><FiPlus aria-hidden="true" /> Add Size</Button>} />

      {loadError ? <ErrorState message={loadError} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 240 }} /> : data.length === 0 ? (
        <EmptyState title="No sizes yet" text="Add the sizes you sell, such as S, M, L or 32, 34, 36." action={<Button variant="primary" onClick={() => open(null)}>Add size</Button>} />
      ) : (
        <DataTable>
          <thead><tr><th style={{ width: 90 }}>ID</th><th>Size</th><th style={{ width: 120 }}>Actions</th></tr></thead>
          <tbody>
            {[...data].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((row) => (
              <tr key={row.id}>
                <td className="num">{row.id}</td>
                <td><strong>{row.size}</strong></td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button type="button" className="icon-btn" aria-label={`Edit size ${row.size}`} onClick={() => open(row)}><FiEdit2 aria-hidden="true" /></button>
                    <button type="button" className="icon-btn" aria-label={`Delete size ${row.size}`} onClick={() => remove(row)}><FiTrash2 aria-hidden="true" /></button>
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
        title={editing?.id ? "Edit size" : "Add size"}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}
      >
        <form onSubmit={save} className="stack" noValidate>
          {error && <p className="notice notice-danger" role="alert">{error}</p>}
          <Field label="Size label" htmlFor="s-label" required>
            <Input id="s-label" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
          </Field>
          <Field label="Display order" htmlFor="s-pos">
            <Input id="s-pos" type="number" min="0" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </Field>
          <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Offer this size" />
        </form>
      </Modal>
    </div>
  );
}
