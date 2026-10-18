"use client";

import AlignedTable from "@/components/AlignedTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiImage, FiPlus, FiTrash2, FiUploadCloud, FiX } from "react-icons/fi";
import Img from "@/components/Img";
import { ImageUploadButton } from "@/components/admin/ImageUploadField";
import { Button, Card, CardHeader, Field, Input, Select, Textarea, Toggle, cx } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, imgUrl, listOf } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "in-stock", label: "In stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "pre-order", label: "Pre-order" },
  { value: "sold-out", label: "Sold out" },
];

const blankForm = () => ({
  title: "",
  sku: "",
  price: "",
  discount: "",
  status: "in-stock",
  categoryId: "",
  shortDescription: "",
  description: "",
  videoUrl: "",
  trackInventory: false,
  sizes: [], // { label, stock, price }
  colors: [], // { name, code, image }
  specifications: [], // { key, value }
  faqs: [], // { question, answer }
  images: [], // { id?, path, url, isNew?, file? }
});

/** Convert a raw product detail (from api/products/:id) into editable form state. */
export function productToForm(raw) {
  const f = blankForm();
  f.title = raw.title || raw.name || "";
  f.sku = raw.sku || "";
  f.price = raw.price ?? "";
  f.discount = raw.discount ?? "";
  f.status = String(raw.status || "in-stock").toLowerCase();
  f.categoryId = Array.isArray(raw.category) ? raw.category[0]?.id ?? "" : raw.category?.id ?? "";
  f.shortDescription = raw.short_description || "";
  f.description = raw.description || "";
  f.videoUrl = raw.video_url || "";
  f.trackInventory = Boolean(raw.inventory?.track_inventory ?? raw.track_inventory);
  f.sizes = (raw.sizes || []).map((s) => ({
    label: s.size ?? s.value ?? "",
    stock: s.pivot?.stock ?? s.stock ?? 0,
    price: s.pivot?.price != null && Number(s.pivot.price) !== Number(raw.price) ? s.pivot.price : "",
  }));
  f.colors = (raw.colors || []).map((c) => ({ name: c.name || "", code: c.code || "#000000", image: c.image || "" }));
  f.specifications = (raw.specifications || []).map((s) => ({ key: s.key || "", value: s.value || "" }));
  f.faqs = (raw.faqs || []).map((q) => ({ question: q.question || "", answer: q.answer || "" }));
  f.images = (raw.images || []).map((img) => ({ id: img.id, path: img.image || img.imageUrl || "", url: img.image_url || img.url || null }));
  return f;
}

export default function ProductForm({ mode, productId, initial }) {
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const { categories } = useSite();
  const [form, setForm] = useState(() => initial || blankForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sizeMaster, setSizeMaster] = useState([]);
  const [newFiles, setNewFiles] = useState([]); // { file, preview }
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api
      .get("api/sizes", { auth: false })
      .then((body) => alive && setSizeMaster(listOf(body).filter((s) => s.is_active !== false && s.isActive !== false)))
      .catch(() => alive && setSizeMaster([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => newFiles.forEach((f) => URL.revokeObjectURL(f.preview)), [newFiles]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setList = (key, updater) => setForm((f) => ({ ...f, [key]: updater(f[key]) }));

  const sizeLabels = useMemo(() => {
    const names = sizeMaster.map((s) => s.size ?? s.name ?? s.value).filter(Boolean);
    return [...new Set([...names, ...form.sizes.map((s) => s.label)])];
  }, [sizeMaster, form.sizes]);

  const toggleSize = (label) => {
    setList("sizes", (list) =>
      list.some((s) => s.label === label) ? list.filter((s) => s.label !== label) : [...list, { label, stock: 0, price: "" }]
    );
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim()) next.title = "Enter a product title.";
    const price = Number(form.price);
    if (form.price === "" || !Number.isFinite(price) || price < 0) next.price = "Enter a valid price.";
    if (form.discount !== "" && (!Number.isFinite(Number(form.discount)) || Number(form.discount) < 0)) next.discount = "Enter a valid sale price.";
    if (form.discount !== "" && Number(form.discount) >= price) next.discount = "The sale price must be lower than the regular price.";
    if (categories.flat.length && !form.categoryId) next.categoryId = "Choose a category.";
    if (form.videoUrl && !/^https?:\/\//i.test(form.videoUrl)) next.videoUrl = "Use a full link starting with https://";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (images) => ({
    title: form.title.trim(),
    sku: form.sku.trim() || undefined,
    price: Number(form.price),
    discount: form.discount === "" ? null : Number(form.discount),
    status: form.status,
    category_id: form.categoryId ? Number(form.categoryId) : null,
    short_description: form.shortDescription.trim(),
    description: form.description,
    video_url: form.videoUrl.trim(),
    inventory: { track_inventory: form.trackInventory },
    sizes: form.sizes.map((s) => ({ size: s.label, stock: Number(s.stock) || 0, price: s.price === "" ? null : Number(s.price) })),
    colors: form.colors.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), code: c.code, image: c.image.trim() || null })),
    specifications: form.specifications.filter((s) => s.key.trim()).map((s) => ({ key: s.key.trim(), value: s.value.trim() })),
    faqs: form.faqs.filter((q) => q.question.trim()).map((q) => ({ question: q.question.trim(), answer: q.answer.trim() })),
    images,
  });

  const uploadFiles = async (id) => {
    for (const item of newFiles) {
      const data = new FormData();
      data.append("image", item.file);
      await api.upload(`api/products/${id}/images`, data);
    }
  };

  const save = async (event) => {
    event?.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const body = await api.post("api/products", buildPayload([]));
        const created = body?.data;
        const id = created?.id ?? body?.id;
        if (!id) throw new Error("The product was saved but no id was returned.");
        await uploadFiles(id);
        toast.success("Product created.");
        router.replace(`/admin/products/${id}`);
        return;
      }
      // Edit: keep existing images that are still listed, then upload any new ones.
      const keep = form.images.filter((img) => img.path).map((img, i) => ({ image: img.path, isPrimary: i === 0 }));
      await api.put(`api/products/${productId}`, buildPayload(keep));
      await uploadFiles(productId);
      setNewFiles([]);
      toast.success("Product saved.");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "The product could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const onFiles = async (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);
    if (picked.length < (fileList?.length || 0)) toast.info("Some files were skipped. Use images under 5 MB.");
    if (!picked.length) return;

    // Editing an existing product: upload immediately (POST /api/products/:id/images,
    // the dedicated product-photo endpoint) and add the returned photos to the list.
    // Creating a product has no id yet, so files stay queued and `uploadFiles`
    // sends them right after the product is created, as before.
    if (mode === "edit" && productId) {
      setUploadingPhotos(true);
      let uploaded = 0;
      const failed = [];
      for (const file of picked) {
        try {
          const data = new FormData();
          data.append("image", file);
          const body = await api.upload(`api/products/${productId}/images`, data);
          const path = body?.data?.image || body?.data?.imageUrl || "";
          if (!path) throw new Error("No image path was returned.");
          setList("images", (list) => [...list, { id: body?.data?.id ?? null, path, url: imgUrl(path) }]);
          uploaded += 1;
        } catch {
          failed.push(file);
        }
      }
      setUploadingPhotos(false);
      if (uploaded) toast.success(uploaded === 1 ? "Photo uploaded." : `${uploaded} photos uploaded.`);
      if (failed.length) {
        setNewFiles((prev) => [...prev, ...failed.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
        toast.info("Some photos could not upload now — they are queued and will upload when you save.");
      }
      return;
    }

    setNewFiles((prev) => [...prev, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const addPhotoByUrl = () => {
    const url = photoUrl.trim();
    if (!url) return;
    setList("images", (list) => [...list, { path: url, url: imgUrl(url) }]);
    setPhotoUrl("");
    toast.info(mode === "edit" ? "Photo added — it will be attached when you save." : "Photo added — it will be saved with the product.");
  };

  const removeExisting = async (img) => {
    const ok = await confirm({ title: "Remove this photo?", message: "It will be removed when you save the product.", confirmText: "Remove", danger: true });
    if (ok) setList("images", (list) => list.filter((i) => i !== img));
  };

  return (
    <form onSubmit={save} noValidate className="stack" style={{ gap: "1.25rem" }}>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Basics" />
            <div className="stack">
              <Field label="Product title" htmlFor="p-title" required error={errors.title}>
                <Input id="p-title" value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} />
              </Field>
              <div className="form-grid">
                <Field label="SKU" htmlFor="p-sku" hint="Optional. Keep it unique.">
                  <Input id="p-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
                </Field>
                <Field label="Category" htmlFor="p-cat" required={categories.flat.length > 0} error={errors.categoryId}>
                  <Select id="p-cat" placeholder="Choose a category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} aria-invalid={!!errors.categoryId}
                    options={categories.flat.map((c) => ({ value: String(c.id), label: `${"— ".repeat(c.depth || 0)}${c.name}` }))} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Regular price (৳)" htmlFor="p-price" required error={errors.price}>
                  <Input id="p-price" type="number" min="0" step="1" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} aria-invalid={!!errors.price} />
                </Field>
                <Field label="Sale price (৳)" htmlFor="p-discount" error={errors.discount} hint="Leave empty for no sale.">
                  <Input id="p-discount" type="number" min="0" step="1" inputMode="decimal" value={form.discount} onChange={(e) => set("discount", e.target.value)} aria-invalid={!!errors.discount} />
                </Field>
              </div>
              <Field label="Availability" htmlFor="p-status">
                <Select id="p-status" options={STATUS_OPTIONS} value={form.status} onChange={(e) => set("status", e.target.value)} />
              </Field>
              <Field label="Short description" htmlFor="p-short">
                <Input id="p-short" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
              </Field>
              <Field label="Description" htmlFor="p-desc" hint="Basic HTML is allowed (paragraphs, lists, bold).">
                <Textarea id="p-desc" rows={7} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Video link" htmlFor="p-video" error={errors.videoUrl}>
                <Input id="p-video" placeholder="https://" value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} aria-invalid={!!errors.videoUrl} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Specifications" subtitle="Shown in the product's Specifications tab." actions={<Button size="sm" variant="ghost" onClick={() => setList("specifications", (l) => [...l, { key: "", value: "" }])}><FiPlus aria-hidden="true" /> Add</Button>} />
            <RowList rows={form.specifications} onChange={(rows) => set("specifications", rows)} fields={[{ key: "key", placeholder: "Fabric" }, { key: "value", placeholder: "Cotton" }]} empty="No specifications yet." />
          </Card>

          <Card>
            <CardHeader title="Questions & answers" actions={<Button size="sm" variant="ghost" onClick={() => setList("faqs", (l) => [...l, { question: "", answer: "" }])}><FiPlus aria-hidden="true" /> Add</Button>} />
            <RowList rows={form.faqs} onChange={(rows) => set("faqs", rows)} fields={[{ key: "question", placeholder: "Question" }, { key: "answer", placeholder: "Answer", textarea: true }]} empty="No questions yet." />
          </Card>
        </div>

        <div className="stack" style={{ gap: "1.25rem" }}>
          <Card>
            <CardHeader title="Photos" subtitle="The first photo is the main image." />
            <div className="photo-grid">
              {form.images.map((img, i) => (
                <div key={`${img.path}-${i}`} className="photo-tile">
                  {img.url ? <Img src={img.url} alt="" fill sizes="120px" /> : <FiImage aria-hidden="true" />}
                  {i === 0 && <span className="photo-main">Main</span>}
                  <button type="button" className="photo-remove" onClick={() => removeExisting(img)} aria-label="Remove photo"><FiX aria-hidden="true" /></button>
                </div>
              ))}
              {newFiles.map((item, i) => (
                <div key={item.preview} className="photo-tile is-new">
                  <Img src={item.preview} alt="" fill sizes="120px" />
                  <span className="photo-main">New</span>
                  <button type="button" className="photo-remove" onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove new photo"><FiX aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            <button type="button" className="dropzone" onClick={() => fileRef.current?.click()} disabled={uploadingPhotos}>
              <FiUploadCloud aria-hidden="true" /> <span>{uploadingPhotos ? "Uploading…" : "Add photos"}</span>{" "}
              <small>
                {mode === "edit"
                  ? "JPG, PNG, WebP or GIF, up to 5 MB each — uploaded immediately"
                  : "JPG, PNG, WebP or GIF, up to 5 MB each — uploaded as soon as the product is created"}
              </small>
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Input
                aria-label="Add photo by URL"
                placeholder="…or paste a photo URL / path"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhotoByUrl(); } }}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addPhotoByUrl} disabled={!photoUrl.trim()}>
                Add by URL
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Inventory & sizes" />
            <div className="stack">
              <Toggle checked={form.trackInventory} onChange={(v) => set("trackInventory", v)} label="Track stock per size" />
              <div className="chip-row" role="group" aria-label="Sizes offered">
                {sizeLabels.length === 0 && <span className="muted" style={{ fontSize: "0.9rem" }}>No sizes have been added in the Sizes section yet.</span>}
                {sizeLabels.map((label) => {
                  const on = form.sizes.some((s) => s.label === label);
                  return <button key={label} type="button" className={cx("chip", on && "is-active")} aria-pressed={on} onClick={() => toggleSize(label)}>{label}</button>;
                })}
              </div>
              {form.sizes.length > 0 && (
                <div className="table-wrap">
                  <AlignedTable className="table">
                    <thead><tr><th>Size</th><th>Stock</th><th>Price override (৳)</th><th /></tr></thead>
                    <tbody>
                      {form.sizes.map((s, i) => (
                        <tr key={s.label}>
                          <td><strong>{s.label}</strong></td>
                          <td><Input aria-label={`Stock for ${s.label}`} type="number" min="0" value={s.stock} onChange={(e) => setList("sizes", (l) => l.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))} style={{ width: 96 }} /></td>
                          <td><Input aria-label={`Price for ${s.label}`} type="number" min="0" placeholder={form.price || "Default"} value={s.price} onChange={(e) => setList("sizes", (l) => l.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} style={{ width: 120 }} /></td>
                          <td><button type="button" className="icon-btn" aria-label={`Remove ${s.label}`} onClick={() => toggleSize(s.label)}><FiTrash2 aria-hidden="true" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </AlignedTable>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Colours" subtitle="Swatches shown on the product page." actions={<Button size="sm" variant="ghost" onClick={() => setList("colors", (l) => [...l, { name: "", code: "#000000", image: "" }])}><FiPlus aria-hidden="true" /> Add</Button>} />
            {form.colors.length === 0 ? <p className="muted" style={{ fontSize: "0.9rem" }}>No colours added.</p> : (
              <div className="stack" style={{ gap: 10 }}>
                {form.colors.map((c, i) => (
                  <div key={i} className="color-row">
                    <input type="color" aria-label="Colour swatch" value={/^#[0-9a-f]{6}$/i.test(c.code) ? c.code : "#000000"} onChange={(e) => setList("colors", (l) => l.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} />
                    <Input aria-label="Colour name" placeholder="Name" value={c.name} onChange={(e) => setList("colors", (l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                      {c.image && imgUrl(c.image) ? <Img src={imgUrl(c.image)} alt="" width={38} height={38} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : null}
                      <Input aria-label="Colour image link" placeholder="Image URL / path (optional)" value={c.image} onChange={(e) => setList("colors", (l) => l.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)))} style={{ flex: 1, minWidth: 0 }} />
                      <ImageUploadButton folder="colors" label={`Upload image for colour ${c.name || i + 1}`} onUploaded={(stored) => setList("colors", (l) => l.map((x, j) => (j === i ? { ...x, image: stored } : x)))} />
                    </div>
                    <button type="button" className="icon-btn" aria-label="Remove colour" onClick={() => setList("colors", (l) => l.filter((_, j) => j !== i))}><FiTrash2 aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="savebar">
        <Link href="/admin/products" className="btn btn-ghost">Cancel</Link>
        <Button type="submit" variant="primary" size="lg" loading={saving} disabled={saving}>
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function RowList({ rows, onChange, fields, empty }) {
  if (!rows.length) return <p className="muted" style={{ fontSize: "0.9rem" }}>{empty}</p>;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((row, i) => (
        <div key={i} className="row-editor">
          {fields.map((f) =>
            f.textarea ? (
              <Textarea key={f.key} rows={2} aria-label={f.placeholder} placeholder={f.placeholder} value={row[f.key]} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))} />
            ) : (
              <Input key={f.key} aria-label={f.placeholder} placeholder={f.placeholder} value={row[f.key]} onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))} />
            )
          )}
          <button type="button" className="icon-btn" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}><FiTrash2 aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  );
}
