"use client";

/**
 * Image field with BOTH ways in: upload from the device, or paste a URL/path.
 *
 * Uploading is immediate (the admin's choice): as soon as a file is picked it
 * is POSTed to the generic admin upload endpoint and the returned stored path
 * fills the field — the parent form then just saves that path as before.
 *
 *   POST /api/admin/upload-image   (new backend route, ADMIN, multipart)
 *     form: image (file), folder (optional allow-listed sub-folder)
 *     201 -> { success, data: { image: "/storage/<folder>/<uuid>.jpg", url: same } }
 *
 * If that endpoint is not running yet, the error is shown under the field and
 * the URL/path input keeps working exactly as it did before.
 */

import { useRef, useState } from "react";
import { FiImage, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { Button, Field, Input } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, imgUrl } from "@/lib/api";

export const ADMIN_UPLOAD_ENDPOINT = "api/admin/upload-image";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImageFile(file) {
  if (!file) return "Choose an image file.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Use a JPG, PNG, WebP or GIF image.";
  if (file.size > MAX_SIZE) return "Images must be under 5 MB.";
  return "";
}

/** Upload one file immediately; resolves to the stored path (e.g. /storage/about/…). */
export async function uploadAdminImage(file, folder = "general") {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const data = new FormData();
  data.append("image", file);
  data.append("folder", folder);
  const body = await api.upload(ADMIN_UPLOAD_ENDPOINT, data);
  const stored = body?.data?.image || body?.data?.url || body?.image || body?.url || "";
  if (!stored) throw new Error("The upload finished but no image path was returned.");
  return stored;
}

/** Compact upload-only button (e.g. inside a product colour row). */
export function ImageUploadButton({ onUploaded, folder = "general", label = "Upload image" }) {
  const { toast } = useFeedback();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const stored = await uploadAdminImage(file, folder);
      onUploaded?.(stored);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err.message || "Image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} disabled={busy} aria-label={label} title={busy ? "Uploading…" : label}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <FiUploadCloud aria-hidden="true" />}
      </button>
    </>
  );
}

/**
 * Full field: preview, Upload-from-device button, URL/path input, Clear.
 * `value` is the image path/URL string; `onChange(nextValue)` receives strings.
 */
export default function ImageUploadField({
  label = "Image",
  value = "",
  onChange,
  id,
  hint = "Upload from your device, or paste an image URL / path. JPG, PNG, WebP or GIF, up to 5 MB.",
  folder = "general",
  required = false,
}) {
  const { toast } = useFeedback();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const preview = imgUrl(value);

  const pick = async (file) => {
    if (!file) return;
    setUploadError("");
    setBusy(true);
    try {
      const stored = await uploadAdminImage(file, folder);
      onChange?.(stored);
      toast.success("Image uploaded.");
    } catch (err) {
      setUploadError(err.message || "Image could not be uploaded. You can still paste an image URL instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} htmlFor={id} hint={hint} required={required} error={uploadError}>
      <div className="stack" style={{ gap: 10 }}>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", background: "var(--brand-tint)" }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" style={{ display: "block", width: "100%", maxHeight: 220, objectFit: "contain", background: "#fff" }} />
          ) : (
            <div className="empty" style={{ padding: "22px 12px", display: "grid", placeItems: "center", gap: 6 }}>
              <FiImage aria-hidden="true" /> <span>No image yet</span>
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <Button type="button" variant="outline" size="sm" loading={busy} disabled={busy} onClick={() => fileRef.current?.click()}>
            <FiUploadCloud aria-hidden="true" /> {busy ? "Uploading…" : "Upload from device"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setUploadError(""); onChange?.(""); }}>
              <FiTrash2 aria-hidden="true" /> Clear image
            </Button>
          ) : null}
        </div>

        <Input
          id={id}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="…or paste an image URL / path, e.g. /storage/about/team.jpg"
        />
      </div>
    </Field>
  );
}
