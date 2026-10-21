"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { FiEdit2, FiImage, FiPlus, FiTrash2 } from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, imgUrl, listOf } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

const EMPTY = { id: null, link: "", display_priority: 0, is_active: true, file: null, preview: null, existing: null };

export default function BannersPage() {
  const { toast, confirm } = useFeedback();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failedImages, setFailedImages] = useState({});
  const { data, loading, error: loadError, reload } = useAsync(() => api.get("api/banners", { auth: false }).then(listOf), []);

  /**
   * Editing re-reads the single banner (GET /api/banners/:id, public) so the form always shows the
   * stored values; the list row is the fallback when the call fails.
   */
  const open = async (row) => {
    setFormError("");
    if (!row) {
      setEditing({});
      setForm(EMPTY);
      return;
    }
    let fresh = row;
    try {
      const body = await api.get(`api/banners/${row.id}`, { auth: false });
      if (body?.data) fresh = { ...row, ...body.data };
    } catch {
      /* keep the row from the list */
    }
    setEditing(fresh);
    setForm({ ...EMPTY, id: fresh.id, link: fresh.link || "", display_priority: fresh.display_priority ?? 0, is_active: fresh.is_active !== false, existing: imgUrl(fresh.image) });
  };

  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setFormError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setFormError("Images must be under 5 MB.");
    setFormError("");
    setFailedImages((current) => {
      if (!form.id || !current[form.id]) return current;
      const next = { ...current };
      delete next[form.id];
      return next;
    });
    setForm((f) => ({ ...f, file, preview: URL.createObjectURL(file) }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.id && !form.file) return setFormError("Choose a banner image.");
    const data = new FormData();
    if (form.file) data.append("image", form.file);
    data.append("link", form.link.trim());
    data.append("display_priority", String(Number(form.display_priority) || 0));
    data.append("is_active", String(form.is_active));
    setBusy(true);
    try {
      // Update must use PUT — POST /api/banners/:id has no handler (405).
      if (form.id) await api.upload(`api/banners/${form.id}`, data, { method: "PUT" });
      else await api.upload("api/banners", data);
      toast.success(form.id ? "Banner updated." : "Banner added.");
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    const ok = await confirm({ title: "Delete this banner?", message: "It will disappear from the homepage.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`api/banners/${row.id}`);
      toast.success("Banner deleted.");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const shown = form.preview || form.existing;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Storefront" title="Banners" subtitle="Hero slides on the homepage, shown in priority order." actions={<Button variant="primary" onClick={() => open(null)}><FiPlus aria-hidden="true" /> New banner</Button>} />

      {loadError ? <ErrorState message={loadError} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 260 }} /> : data.length === 0 ? (
        <EmptyState icon={FiImage} title="No banners yet" text="Upload a wide image to feature on the homepage." action={<Button variant="primary" onClick={() => open(null)}>Add banner</Button>} />
      ) : (
        <div className="grid-3 stagger" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
          {[...data].sort((a, b) => (a.display_priority ?? 0) - (b.display_priority ?? 0)).map((b) => (
            <article key={b.id} className="card" style={{ overflow: "hidden" }}>
              <div style={{ position: "relative", aspectRatio: "16 / 8", background: "var(--brand-tint)" }}>
                {failedImages[b.id] ? <div className="empty" style={{ height: "100%", display: "grid", placeItems: "center" }}><FiImage aria-hidden="true" /> Image unavailable</div> : <Img src={imgUrl(b.image)} alt="" fill sizes="320px" onError={() => setFailedImages((current) => ({ ...current, [b.id]: true }))} />}
              </div>
              <div style={{ padding: 14, display: "grid", gap: 8 }}>
                <div className="between">
                  <span className="num muted">Position {b.display_priority ?? 0}</span>
                  {b.is_active === false ? <Badge tone="neutral">Hidden</Badge> : <Badge tone="success">Live</Badge>}
                </div>
                <span className="muted" style={{ fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.link ? <Link href={b.link} target="_blank" rel="noopener">{b.link}</Link> : "No link"}
                </span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button type="button" className="icon-btn" aria-label="Edit banner" onClick={() => open(b)}><FiEdit2 aria-hidden="true" /></button>
                  <button type="button" className="icon-btn" aria-label="Delete banner" onClick={() => remove(b)}><FiTrash2 aria-hidden="true" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={form.id ? "Edit banner" : "New banner"}
        width="620px"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save banner</Button></>}
      >
        <form onSubmit={save} className="stack" noValidate>
          {error && <p className="notice notice-danger" role="alert">{error}</p>}
          <div>
            <div style={{ position: "relative", aspectRatio: "16 / 8", borderRadius: 12, overflow: "hidden", background: "var(--brand-tint)", marginBottom: 10 }}>
              {shown && !failedImages[form.id] ? <Img src={shown} alt="" fill sizes="560px" onError={() => form.id && setFailedImages((current) => ({ ...current, [form.id]: true }))} /> : <div className="empty" style={{ height: "100%", display: "grid", placeItems: "center" }}><FiImage aria-hidden="true" /> {form.file ? "Preview unavailable" : "Image unavailable"}</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{form.id ? "Replace image" : "Choose image"}</Button>
          </div>
          <Field label="Link (optional)" htmlFor="b-link" hint="Where the banner goes when tapped, e.g. /shop">
            <Input id="b-link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          </Field>
          <Field label="Display order" htmlFor="b-order" hint="Lower numbers show first.">
            <Input id="b-order" type="number" min="0" value={form.display_priority} onChange={(e) => setForm({ ...form, display_priority: e.target.value })} />
          </Field>
          <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Show on the homepage" />
        </form>
      </Modal>
    </div>
  );
}
