"use client";

/**
 * Edit banner / Add Banner Images (Zuberee parity).
 *
 * Zuberee reference: GET /dashboard/banners/edit/:id — "Add Banner Images" form
 * with Select Type (Hero Section Slider / Slot / Category), Select category,
 * Select Slot, a Give link field and image upload, saved with Save.
 * Zuberee's Banners list page edits a banner's image/link/order/active flag
 * in a modal; this route is the standalone Zuberee-style edit page.
 *
 * FRONTEND ONLY (backend APIs to be wired by the backend dev, no UI change needed):
 *   GET  /api/banners/:id                 -> banner { id, image, link, type, ... }
 *   PUT  /api/banners/:id                 multipart (api.upload with method PUT,
 *                                          same as Admin -> Banners) with:
 *                                          link, type, products_slots_id (slot only),
 *                                          category_id (category only), image (optional),
 *                                          display_priority, is_active
 *   GET  /api/product-slots               -> slot options for the Slot select
 *   GET  /api/categories                  -> category options for the Category select
 * Until they answer, the form still renders in full and submitting shows the
 * server message instead of faking a save.
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiImage, FiInfo, FiSave } from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Select, Skeleton, Toggle } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, imgUrl, listOf } from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "hero", label: "Hero Section Slider" },
  { value: "slot", label: "Slot" },
  { value: "category", label: "Category" },
];

export default function BannerEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setFormError] = useState("");
  const [slotOptions, setSlotOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [form, setForm] = useState({
    link: "",
    type: "hero",
    products_slots_id: "",
    category_id: "",
    display_priority: 0,
    is_active: true,
    file: null,
    preview: null,
    existing: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = await api.get(`api/banners/${id}`, { auth: false });
        const banner = body?.data || body || {};
        if (!alive) return;
        setForm((current) => ({
          ...current,
          link: banner.link || "",
          type: banner.type || "hero",
          products_slots_id: banner.products_slots_id ? String(banner.products_slots_id) : "",
          category_id: banner.category_id ? String(banner.category_id) : "",
          display_priority: banner.display_priority ?? 0,
          is_active: banner.is_active !== false,
          existing: imgUrl(banner.image),
        }));
      } catch {
        if (alive) setBackendReady(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    (async () => {
      try {
        const slots = listOf(await api.get("api/product-slots", { auth: false }));
        if (alive) setSlotOptions(slots.map((slot) => ({ value: String(slot.id ?? slot.value ?? ""), label: slot.name || slot.title || `Slot ${slot.id}` })).filter((o) => o.value));
      } catch {
        /* frontend-only: the Slot select stays empty until the endpoint exists */
      }
      try {
        const categories = listOf(await api.get("api/categories", { auth: false }));
        if (alive) setCategoryOptions(categories.map((cat) => ({ value: String(cat.id ?? ""), label: cat.name || cat.title || `Category ${cat.id}` })).filter((o) => o.value));
      } catch {
        /* frontend-only: the Category select stays empty until the endpoint exists */
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setFormError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setFormError("Images must be under 5 MB.");
    setFormError("");
    setForm((current) => ({ ...current, file, preview: URL.createObjectURL(file) }));
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const data = new FormData();
      data.append("link", form.link.trim());
      data.append("type", form.type);
      if (form.type === "slot") data.append("products_slots_id", form.products_slots_id);
      if (form.type === "category") data.append("category_id", form.category_id);
      data.append("display_priority", String(Number(form.display_priority) || 0));
      data.append("is_active", String(form.is_active));
      if (form.file) data.append("image", form.file);
      await api.upload(`api/banners/${id}`, data, { method: "PUT" });
      toast.success("Banner updated successfully");
      router.push("/admin/banners");
    } catch (err) {
      setFormError(err.message || "Banner could not be saved. The backend update endpoint may not be connected yet.");
    } finally {
      setBusy(false);
    }
  };

  const shown = form.preview || form.existing;
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 860 }}>
      <AdminHeader
        eyebrow="Storefront"
        title="Add Banner Images"
        subtitle={`Banner #${id} — type, placement and image, as on Zuberee's banner edit page.`}
        actions={
          <Button variant="ghost" href="/admin/banners">
            <FiArrowLeft aria-hidden="true" /> Banners
          </Button>
        }
      />

      {!backendReady && (
        <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
          <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Frontend only for now: banner <span className="num">#{id}</span> could not be loaded from the
            backend, so the form below starts empty. Backend dev — wire the endpoints listed in this
            file&apos;s header comment and it works unchanged.
          </span>
        </div>
      )}

      {loading ? (
        <Skeleton style={{ height: 420 }} />
      ) : (
        <Card>
          <CardHeader title="Banner images" subtitle="Choose where this banner appears, then its image and link." />
          <form onSubmit={save} className="stack" noValidate>
            {error && (
              <p className="notice notice-danger" role="alert">
                {error}
              </p>
            )}

            <Field label="Select Type" htmlFor="banner-edit-type" required>
              <Select id="banner-edit-type" name="type" value={form.type} onChange={(e) => set("type")(e.target.value)} options={TYPE_OPTIONS} />
            </Field>

            {form.type === "category" && (
              <Field label="Select category" htmlFor="banner-edit-category">
                <Select
                  id="banner-edit-category"
                  name="category_id"
                  value={form.category_id}
                  onChange={(e) => set("category_id")(e.target.value)}
                  options={categoryOptions}
                  placeholder="Select category"
                />
              </Field>
            )}

            {form.type === "slot" && (
              <Field label="Select Slot" htmlFor="banner-edit-slot">
                <Select
                  id="banner-edit-slot"
                  name="products_slots_id"
                  value={form.products_slots_id}
                  onChange={(e) => set("products_slots_id")(e.target.value)}
                  options={slotOptions}
                  placeholder="Select Slot"
                />
              </Field>
            )}

            <div>
              <div style={{ position: "relative", aspectRatio: "16 / 8", borderRadius: 12, overflow: "hidden", background: "var(--brand-tint)", marginBottom: 10 }}>
                {shown ? (
                  <Img src={shown} alt="" fill sizes="720px" />
                ) : (
                  <div className="empty" style={{ height: "100%", display: "grid", placeItems: "center" }}>
                    <FiImage aria-hidden="true" /> Select Image
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
              <Field label="Image" htmlFor="banner-edit-image-btn">
                <Button type="button" id="banner-edit-image-btn" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  {form.file || form.existing ? "Replace image" : "Choose image"}
                </Button>
              </Field>
            </div>

            <Field label="Link" htmlFor="banner-edit-link">
              <Input id="banner-edit-link" name="link" value={form.link} onChange={(e) => set("link")(e.target.value)} placeholder="Give link" />
            </Field>

            <div className="form-grid">
              <Field label="Display order" htmlFor="banner-edit-order" hint="Lower numbers show first.">
                <Input id="banner-edit-order" type="number" min="0" value={form.display_priority} onChange={(e) => set("display_priority")(e.target.value)} />
              </Field>
              <Field label="Visibility">
                <Toggle checked={form.is_active} onChange={set("is_active")} label="Show on the homepage" />
              </Field>
            </div>

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Link href="/admin/banners" className="btn btn-ghost">
                Cancel
              </Link>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                <FiSave aria-hidden="true" /> Save
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
