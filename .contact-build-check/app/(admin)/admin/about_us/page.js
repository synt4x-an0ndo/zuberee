"use client";

import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import SafeHtml from "@/components/SafeHtml";
import { AdminHeader } from "@/components/admin/AdminPage";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Skeleton, Textarea } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, imgUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/**
 * GET /api/about-us          public  -> { id, title, content, image, created_at, updated_at }
 *                                      (404 { message: "About us not configured yet." } when empty)
 * PUT /api/admin/about-us    ADMIN   <- { title?, content?, image? }
 *                                      200 "About us updated." / 201 "About us created."
 *                                      Creating requires BOTH title and content.
 *
 * `content` is an HTML string — the storefront renders it through <SafeHtml>.
 *
 * The image field accepts a pasted path/URL or an upload from the device:
 * uploads go to POST /api/admin/upload-image (folder "about") and the returned
 * /storage/about/... path fills the field before this page saves it as `image`.
 */
export default function AboutUsAdminPage() {
  const { toast } = useFeedback();
  const { reload: reloadSite } = useSite();
  const { data, loading, error, reload } = useAsync(async () => {
    const body = await api.get("api/about-us", { auth: false }).catch((err) => (err.status === 404 ? null : Promise.reject(err)));
    return body;
  }, []);

  const [form, setForm] = useState({ title: "", content: "", image: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({ title: data.title || "", content: data.content || "", image: data.image || "" });
  }, [data]);

  const exists = Boolean(data?.id);

  const save = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.title.trim()) return setFormError("A title is required.");
    if (!form.content.trim()) return setFormError("Content is required.");
    setBusy(true);
    try {
      const body = await api.put("api/admin/about-us", {
        title: form.title.trim(),
        content: form.content,
        image: form.image.trim(),
      });
      toast.success(body?.message || "About us saved.");
      reload();
      reloadSite();
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const preview = imgUrl(form.image);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Storefront"
        title="About us"
        subtitle="The story and imagery shown on the storefront About page."
        actions={exists ? <Badge tone="success">Published {data.updated_at ? formatDateTime(data.updated_at) : ""}</Badge> : <Badge tone="warn">Not created yet</Badge>}
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <Skeleton style={{ height: 420 }} /> : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Card>
            <CardHeader title={exists ? "Edit content" : "Create content"} subtitle="Saving creates the record the first time." />
            <form onSubmit={save} className="stack" noValidate>
              {formError && <p className="notice notice-danger" role="alert">{formError}</p>}
              <Field label="Title" htmlFor="au-title" required>
                <Input id="au-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Field>
              <Field label="Content (HTML)" htmlFor="au-content" hint="Basic HTML such as <p>, <h2>, <ul> is allowed.">
                <Textarea id="au-content" rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </Field>
              <ImageUploadField
                label="Image"
                id="au-image"
                folder="about"
                hint="Upload from your device (it fills in the path), or paste an image URL / path — leave blank for no image."
                value={form.image}
                onChange={(image) => setForm({ ...form, image })}
              />
              <div>
                <Button type="submit" variant="primary" loading={busy} disabled={busy}><FiSave aria-hidden="true" /> {exists ? "Save content" : "Create content"}</Button>
              </div>
            </form>
          </Card>

          <div className="stack" style={{ gap: "1.25rem" }}>
            <Card>
              <CardHeader title="Image preview" />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="About us preview" style={{ display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--line)" }} />
              ) : (
                <p className="muted">No image set. Add a path to preview it here.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Storefront preview" subtitle="How the content renders on /about_us." />
              <div style={{ display: "grid", gap: 10 }}>
                <strong style={{ fontSize: "1.1rem" }}>{form.title || "About us title"}</strong>
                {form.content ? (
                  <SafeHtml html={form.content} />
                ) : (
                  <p className="muted">Content preview appears here.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
