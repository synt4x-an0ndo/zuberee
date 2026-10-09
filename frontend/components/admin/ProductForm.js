"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { api, imgUrl, unwrapList } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

/**
 * Shared product create/edit form.
 * create: POST  api/products                 (JSON)
 * edit:   PUT   api/products/{id}             (JSON)
 * lists : GET   api/categories
 *
 * Array fields follow the JSON contract implemented by the backend route.
 */
export default function ProductForm({ id, initial }) {
  const fileRef = useRef(null);
  const [catList, setCatList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const empty = {
    title: "",
    sku: "",
    price: "",
    discount: "",
    status: "IN_STOCK",
    short_description: "",
    description: "",
    video_url: "",
    stock: "",
    isActive: true,
    track_inventory: false,
    categoryId: "",
  };

  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const [categories, setCategories] = useState(initial?.categories || []);
  const [colors, setColors] = useState(initial?.colors || []);
  const [sizes, setSizes] = useState(initial?.sizes || []);
  const [faqs, setFaqs] = useState(initial?.faqs || []);
  const [specs, setSpecs] = useState(initial?.specifications || []);
  const [images, setImages] = useState(initial?.images || []); // strings + Files
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!initial) return;
    setForm((f) => ({ ...f, ...initial }));
  }, [initial]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await api.get("api/categories").catch(() => ({ data: [] }));
        if (!alive) return;
        setCatList(unwrapList(c, ["categories"]));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* row helpers */
  const rowSet = (setter) => (i, k, v) =>
    setter((list) => {
      const next = [...list];
      next[i] = { ...next[i], [k]: v };
      return next;
    });

  const toggleCat = (catId) => {
    const selected = categories.some((c) => c.id === catId) ? [] : [{ id: catId }];
    setCategories(selected);
    set("categoryId", selected[0]?.id || "");
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        resolve(null);
        return;
      }
      if (!file.type.startsWith("image/")) {
        reject(new Error("Only image files can be added"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the selected image"));
      reader.readAsDataURL(file);
    });

  const imageValue = async (value) =>
    typeof value === "string" ? value.trim() : await fileToDataUrl(value);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title?.trim()) {
      notify.error("Product title is required");
      return;
    }
    const categoryId = Number(form.categoryId || categories[0]?.id);
    const price = Number(form.price);
    const discount = form.discount === "" || form.discount == null
      ? null
      : Number(form.discount);
    const stock = form.stock === "" || form.stock == null
      ? undefined
      : Number(form.stock);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      notify.error("A valid product category is required");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      notify.error("A valid product price is required");
      return;
    }
    if (discount !== null && (!Number.isFinite(discount) || discount < 0)) {
      notify.error("Discount must be a valid non-negative number");
      return;
    }
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      notify.error("Stock must be a non-negative whole number");
      return;
    }
    setSaving(true);
    try {
      const uploadedImages = images.filter((image) => image instanceof File);
      const savedImages = images
        .filter((image) => typeof image === "string" && image.trim())
        .map((image) => image.trim());
      const savedColors = await Promise.all(
        colors
          .filter((color) => color.name?.trim() || color.code?.trim() || color.image)
          .map(async (color) => ({
            name: color.name?.trim() || "",
            code: color.code?.trim() || "",
            image: (await imageValue(color.image)) || null,
          }))
      );
      const payload = {
        name: form.title.trim(),
        sku: form.sku?.trim() || "",
        price,
        discount,
        status: form.status || "IN_STOCK",
        shortDescription: form.short_description || "",
        description: form.description || "",
        videoUrl: form.video_url || null,
        ...(stock === undefined ? {} : { stock }),
        ...(typeof form.isActive === "boolean" ? { isActive: form.isActive } : {}),
        categoryId,
        images: savedImages.map((image, index) => ({ image, isPrimary: index === 0 })),
        colors: savedColors,
        sizes: sizes
          .filter((size) => (size.value || size.size || size.size_id)?.toString().trim())
          .map((size) => ({
            value: (size.value || size.size || size.size_id).toString().trim(),
            price: size.price === "" || size.price == null ? null : Number(size.price),
            stock: Number(size.stock) || 0,
          })),
        specifications: specs
          .filter((specification) => specification.key?.trim() || specification.value?.trim())
          .map((specification) => ({
            key: specification.key?.trim() || "",
            value: specification.value?.trim() || "",
          })),
        faqs: faqs
          .filter((faq) => faq.question?.trim() || faq.answer?.trim())
          .map((faq) => ({
            question: faq.question?.trim() || "",
            answer: faq.answer?.trim() || "",
          })),
        inventory: { track_inventory: Boolean(form.track_inventory) },
      };

      let savedProduct;
      if (id) {
        savedProduct = await api.put(`api/products/${id}`, payload);
      } else {
        savedProduct = await api.post("api/products", payload);
      }
      const productId = id || savedProduct?.data?.id;
      if (productId && uploadedImages.length > 0) {
        await Promise.all(
          uploadedImages.map((file) => {
            const formData = new FormData();
            formData.append("image", file);
            return api.upload(`api/products/${productId}/images`, formData);
          })
        );
      }
      notify.success(id ? "Product Updated Successfully" : "Product Created Successfully");
      window.location.href = "/dashboard/products";
    } catch (err) {
      const validationErrors = err.data?.errors;
      const detail = validationErrors && typeof validationErrors === "object"
        ? Object.values(validationErrors).flat().join(" ")
        : "";
      notify.error(detail || err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const colorImg = (i, file) =>
    setColors((list) => {
      const next = [...list];
      next[i] = { ...next[i], image: file };
      return next;
    });

  const addImageUrl = () => {
    const value = imageUrl.trim();
    if (!value) return;
    setImages((list) => [...list, value]);
    setImageUrl("");
  };

  if (loading) return <Loader />;

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0 fw-bold">{id ? "Edit Product" : "Add Product"}</h4>
          <Link href="/dashboard/products" className="btn btn-sm btn-outline-secondary">
            ← Back to Products
          </Link>
        </div>

        <form onSubmit={submit}>
          {/* ===== basics ===== */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Product Title *</label>
                  <input
                    className="form-control"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">SKU</label>
                  <input
                    className="form-control"
                    value={form.sku}
                    onChange={(e) => set("sku", e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    <option value="IN_STOCK">In Stock</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                    <option value="PRE_ORDER">Pre-order</option>
                    <option value="DISCONTINUED">Discontinued</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Base Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Discount Price (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={form.discount}
                    onChange={(e) => set("discount", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Video URL</label>
                  <input
                    className="form-control"
                    placeholder="https://..."
                    value={form.video_url}
                    onChange={(e) => set("video_url", e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Stock</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.stock}
                    onChange={(e) => set("stock", e.target.value)}
                  />
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <label className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.isActive)}
                      onChange={(e) => set("isActive", e.target.checked)}
                    />
                    <span className="form-check-label">Active</span>
                  </label>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <label className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(form.track_inventory)}
                      onChange={(e) => set("track_inventory", e.target.checked)}
                    />
                    <span className="form-check-label">Track inventory</span>
                  </label>
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Short Description</label>
                  <input
                    className="form-control"
                    value={form.short_description}
                    onChange={(e) => set("short_description", e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Description</label>
                  <textarea
                    rows={5}
                    className="form-control"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ===== categories ===== */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3">Categories</h6>
              <div className="d-flex flex-wrap gap-3">
                {catList.map((c) => {
                  const on = categories.some((x) => x.id === c.id);
                  return (
                    <label
                      key={c.id}
                      className={`badge border px-3 py-2 ${on ? "bg-primary text-white" : "bg-light text-dark"
                        }`}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        className="me-2"
                        checked={on}
                        onChange={() => toggleCat(c.id)}
                      />
                      {c.name}
                    </label>
                  );
                })}
                {catList.length === 0 && (
                  <span className="text-muted small">No categories available</span>
                )}
              </div>
            </div>
          </div>

          {/* ===== colors ===== */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Colors</h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setColors((l) => [...l, { name: "", code: "", image: "" }])
                  }
                >
                  <FaPlus /> Add Color
                </button>
              </div>
              {colors.length === 0 && <p className="text-muted small mb-0">No colors</p>}
              {colors.map((c, i) => (
                <div key={i} className="row g-2 align-items-center mb-2">
                  <div className="col-md-3">
                    <input
                      className="form-control"
                      placeholder="Name"
                      value={c.name || ""}
                      onChange={(e) => rowSet(setColors)(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      className="form-control"
                      placeholder="#hex code"
                      value={c.code || ""}
                      onChange={(e) => rowSet(setColors)(i, "code", e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      type="file"
                      accept="image/*"
                      className="form-control"
                      onChange={(e) => colorImg(i, e.target.files?.[0] || "")}
                    />
                    <input
                      className="form-control form-control-sm mt-1"
                      placeholder="Existing image URL"
                      value={typeof c.image === "string" ? c.image : ""}
                      onChange={(e) => rowSet(setColors)(i, "image", e.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger w-100"
                      onClick={() => setColors((l) => l.filter((_, j) => j !== i))}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== sizes ===== */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Size Variants</h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setSizes((l) => [...l, { size_id: "", price: "", stock: "" }])
                  }
                >
                  <FaPlus /> Add Size
                </button>
              </div>
              {sizes.map((s, i) => (
                <div key={i} className="row g-2 align-items-center mb-2">
                  <div className="col-md-4">
                    <input
                      className="form-select"
                      placeholder="Size (e.g. UK 6)"
                      value={s.value || s.size || s.size_id || ""}
                      onChange={(e) => rowSet(setSizes)(i, "value", e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="Price override"
                      value={s.price ?? ""}
                      onChange={(e) => rowSet(setSizes)(i, "price", e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Stock"
                      value={s.stock ?? ""}
                      onChange={(e) => rowSet(setSizes)(i, "stock", e.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger w-100"
                      onClick={() => setSizes((l) => l.filter((_, j) => j !== i))}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
              {sizes.length === 0 && (
                <p className="text-muted small mb-0">No size variants configured</p>
              )}
            </div>
          </div>

          {/* ===== images ===== */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <h6 className="fw-bold mb-3">Images</h6>
              <div className="d-flex flex-wrap gap-3 align-items-center mb-2">
                {images.map((im, i) => (
                  <div key={i} className="position-relative">
                    <img
                      src={typeof im === "string" ? imgUrl(im) : URL.createObjectURL(im)}
                      alt=""
                      width={72}
                      height={72}
                      style={{ objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }}
                    />
                    <button
                      type="button"
                      className="position-absolute btn btn-danger btn-sm"
                      style={{ top: -8, right: -8, padding: "0 5px", lineHeight: 1.1 }}
                      onClick={() => setImages((l) => l.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline-dashed"
                  style={{
                    width: 72,
                    height: 72,
                    border: "2px dashed #bbb",
                    background: "transparent",
                  }}
                  onClick={() => fileRef.current?.click()}
                  aria-label="Choose product photos"
                >
                  <FaPlus className="d-block mx-auto mb-1" />
                  <span className="small">Choose photos</span>
                </button>
                <div className="input-group" style={{ maxWidth: 360 }}>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Image URL from backend"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addImageUrl();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addImageUrl}>
                    Add URL
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) setImages((list) => [...list, ...files]);
                    e.target.value = "";
                  }}
                />
              </div>
              <small className="text-muted">
                Choose one or more photos, or add a saved image URL. Photos upload to product storage after saving; the first image is the cover.
              </small>
            </div>
          </div>

          {/* ===== faq ===== */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">FAQ</h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setFaqs((l) => [...l, { question: "", answer: "" }])}
                >
                  <FaPlus /> Add Question
                </button>
              </div>
              {faqs.map((f, i) => (
                <div key={i} className="mb-2">
                  <div className="d-flex gap-2 mb-1">
                    <input
                      className="form-control"
                      placeholder="Question"
                      value={f.question || ""}
                      onChange={(e) => rowSet(setFaqs)(i, "question", e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => setFaqs((l) => l.filter((_, j) => j !== i))}
                    >
                      <FaTrash />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Answer"
                    value={f.answer || ""}
                    onChange={(e) => rowSet(setFaqs)(i, "answer", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ===== specifications ===== */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0">Product Specifications</h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setSpecs((l) => [...l, { key: "", value: "" }])}
                >
                  <FaPlus /> Add Specification
                </button>
              </div>
              {specs.map((s, i) => (
                <div key={i} className="row g-2 mb-2">
                  <div className="col-md-5">
                    <input
                      className="form-control"
                      placeholder="Specification"
                      value={s.key || ""}
                      onChange={(e) => rowSet(setSpecs)(i, "key", e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <input
                      className="form-control"
                      placeholder="Value"
                      value={s.value || ""}
                      onChange={(e) => rowSet(setSpecs)(i, "value", e.target.value)}
                    />
                  </div>
                  <div className="col-md-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger w-100"
                      onClick={() => setSpecs((l) => l.filter((_, j) => j !== i))}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="d-flex gap-2 mb-4">
            <button className="btn btn-grad px-4 fw-semibold" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Saving...
                </>
              ) : id ? (
                "Update Product"
              ) : (
                "Create Product"
              )}
            </button>
            <Link href="/dashboard/products" className="btn btn-outline-secondary px-4">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
