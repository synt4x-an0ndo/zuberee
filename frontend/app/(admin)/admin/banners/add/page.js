"use client";

/**
 * Create Hero Banner (Eyara parity).
 *
 * Eyara reference: GET /dashboard/banners/add — "Create Hero Banner" form with
 * one or more Image + Link rows ("+ Add More"), then "Create Banner".
 * Zuberee's Banners list page creates banners in a modal; this route is the
 * standalone page form so the Eyara URL structure is fully covered.
 *
 * FRONTEND ONLY (backend API to be wired by the backend dev, no UI change needed):
 *   POST /api/banners   multipart per banner: image, link, display_priority, is_active
 * That is the exact create call Admin -> Banners already makes for one banner;
 * this page simply loops it for every row. Until it answers, submitting shows
 * the server message in the form instead of faking a save.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FiArrowLeft, FiImage, FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";

let rowKey = 0;
const newRow = () => {
  rowKey += 1;
  return { key: rowKey, file: null, preview: null, link: "", display_priority: 0, is_active: true };
};

export default function BannerAddPage() {
  const router = useRouter();
  const { toast } = useFeedback();
  const [rows, setRows] = useState([newRow()]);
  const [error, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key, patch) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const pickFile = (row, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setFormError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setFormError("Images must be under 5 MB.");
    setFormError("");
    update(row.key, { file, preview: URL.createObjectURL(file) });
  };

  const save = async (event) => {
    event.preventDefault();
    if (rows.some((row) => !row.file)) return setFormError("Choose an image for every banner row (or remove the empty row).");
    setBusy(true);
    setFormError("");
    try {
      for (const row of rows) {
        const data = new FormData();
        data.append("image", row.file);
        data.append("link", row.link.trim());
        data.append("display_priority", String(Number(row.display_priority) || 0));
        data.append("is_active", String(row.is_active));
        await api.upload("api/banners", data); // sequential: banners must be created in display order
      }
      toast.success(rows.length === 1 ? "Banner created successfully" : "Banners created successfully");
      router.push("/admin/banners");
    } catch (err) {
      setFormError(err.message || "Banner could not be saved. The backend create endpoint may not be connected yet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 860 }}>
      <AdminHeader
        eyebrow="Storefront"
        title="Create Hero Banner"
        subtitle="Upload hero slides for the homepage. Add more rows to create several banners at once."
        actions={
          <Button variant="ghost" href="/admin/banners">
            <FiArrowLeft aria-hidden="true" /> Banners
          </Button>
        }
      />

      <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
        <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
        <span>
          Frontend only for now. Backend dev — this form posts each row to{" "}
          <span className="num">POST /api/banners</span> (multipart: image, link, display_priority, is_active),
          the same endpoint Admin -&gt; Banners uses. No UI change is needed when it is ready.
        </span>
      </div>

      <Card>
        <CardHeader title="Banner details" subtitle="Wide images work best (the homepage shows them at 16 / 8)." />
        <form onSubmit={save} className="stack" noValidate>
          {error && (
            <p className="notice notice-danger" role="alert">
              {error}
            </p>
          )}

          {rows.map((row, index) => (
            <BannerRow
              key={row.key}
              row={row}
              index={index}
              canRemove={rows.length > 1}
              onPick={(file) => pickFile(row, file)}
              onChange={(patch) => update(row.key, patch)}
              onRemove={() => setRows((current) => current.filter((item) => item.key !== row.key))}
            />
          ))}

          <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
            <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, newRow()])}>
              <FiPlus aria-hidden="true" /> Add More
            </Button>
            <div className="row" style={{ gap: 8 }}>
              <Link href="/admin/banners" className="btn btn-ghost">
                Cancel
              </Link>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                Create Banner
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

function BannerRow({ row, index, canRemove, onPick, onChange, onRemove }) {
  const fileRef = useRef(null);
  return (
    <div className="stack" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
      <div className="between">
        <strong>Banner {index + 1}</strong>
        {canRemove && (
          <button type="button" className="icon-btn" aria-label={`Remove banner ${index + 1}`} onClick={onRemove}>
            <FiTrash2 aria-hidden="true" />
          </button>
        )}
      </div>

      <div>
        <div style={{ position: "relative", aspectRatio: "16 / 8", borderRadius: 12, overflow: "hidden", background: "var(--brand-tint)", marginBottom: 10 }}>
          {row.preview ? (
            <Img src={row.preview} alt="" fill sizes="720px" />
          ) : (
            <div className="empty" style={{ height: "100%", display: "grid", placeItems: "center" }}>
              <FiImage aria-hidden="true" /> No banner yet
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
        <Field label="Image" htmlFor={`banner-add-image-${row.key}`} required>
          <Button type="button" id={`banner-add-image-${row.key}`} variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            {row.file ? "Replace image" : "Choose image"}
          </Button>
        </Field>
      </div>

      <div className="form-grid">
        <Field label="Link" htmlFor={`banner-add-link-${row.key}`} hint="Where the banner goes when tapped, e.g. /shop">
          <Input id={`banner-add-link-${row.key}`} value={row.link} onChange={(e) => onChange({ link: e.target.value })} placeholder="Give link" />
        </Field>
        <Field label="Display order" htmlFor={`banner-add-order-${row.key}`} hint="Lower numbers show first.">
          <Input id={`banner-add-order-${row.key}`} type="number" min="0" value={row.display_priority} onChange={(e) => onChange({ display_priority: e.target.value })} />
        </Field>
      </div>
      <Toggle checked={row.is_active} onChange={(value) => onChange({ is_active: value })} label="Show on the homepage" />
    </div>
  );
}
