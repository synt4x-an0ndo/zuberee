"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { api, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Shared product create/edit form.
 * create: POST  api/products                 (multipart/form-data)
 * edit:   POST  api/products/{id}            (multipart + _method=PUT)
 * lists : GET   api/product_add_category, api/sizes
 *
 * Array fields use Laravel conventions:
 *   colors[i][code|name|image], sizes[i][size_id|price|stock],
 *   categories[i][category_id], faqs[i][question|answer],
 *   specifications[i][key|value], image[] (files)
 */
export default function ProductForm({ id, initial }) {
  const fileRef = useRef(null);
  const [catList, setCatList] = useState([]);
  const [sizeList, setSizeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const empty = {
    title: "",
    sku: "",
    price: "",
    discount: "",
    status: "in-stock",
    short_description: "",
    description: "",
    video_url: "",
  };

  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const [categories, setCategories] = useState(initial?.categories || []);
  const [colors, setColors] = useState(initial?.colors || []);
  const [sizes, setSizes] = useState(initial?.sizes || []);
  const [faqs, setFaqs] = useState(initial?.faqs || []);
  const [specs, setSpecs] = useState(initial?.specifications || []);
  const [images, setImages] = useState(initial?.images || []); // strings + Files

  useEffect(() => {
    if (!initial) return;
    setForm((f) => ({ ...f, ...initial }));
  }, [initial]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, s] = await Promise.all([
          api.get("api/product_add_category").catch(() => ({ data: [] })),
          api.get("api/sizes", { auth: false }).catch(() => ({ data: [] })),
        ]);
        if (!alive) return;
        setCatList(Array.isArray(c?.data) ? c.data : Array.isArray(c) ? c : []);
        setSizeList(Array.isArray(s?.data) ? s.data : Array.isArray(s) ? s : []);
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
      const next = clone(list);
      next[i] = { ...next[i], [k]: v };
      return next;
    });

  const toggleCat = (catId) =>
    setCategories((list) =>
      list.some((c) => c.id === catId)
        ? list.filter((c) => c.id !== catId)
        : [...list, { id: catId }]
    );

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title?.trim()) {
      notify.error("Product title is required");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("short_description", form.short_description || "");
      fd.append("video_url", form.video_url || "");
      fd.append("description", form.description || "");
      fd.append("discount", form.discount ?? "");
      fd.append("status", form.status || "in-stock");
      if (form.price !== "" && form.price != null) fd.append("price", form.price);
      if (form.sku != null && form.sku !== "") fd.append("sku", form.sku);

      colors.forEach((c, i) => {
        if (c.code) fd.append(`colors[${i}][code]`, c.code);
        if (c.name) fd.append(`colors[${i}][name]`, c.name);
        if (c.image) fd.append(`colors[${i}][image]`, c.image);
      });

      sizes
        .filter((s) => s.size_id)
        .forEach((s, i) => {
          fd.append(`sizes[${i}][size_id]`, s.size_id);
          if (s.price !== "" && s.price != null) fd.append(`sizes[${i}][price]`, s.price);
          if (s.stock !== "" && s.stock != null) fd.append(`sizes[${i}][stock]`, s.stock);
        });

      categories.forEach((c, i) => fd.append(`categories[${i}][category_id]`, c.id));

      images
        .filter((im) => im)
        .forEach((im) => fd.append("image[]", im));

      faqs
        .filter((f) => (f.question || "").trim())
        .forEach((f, i) => {
          fd.append(`faqs[${i}][question]`, f.question);
          fd.append(`faqs[${i}][answer]`, f.answer || "");
        });

      specs
        .filter((s) => (s.key || "").trim() && (s.value || "").trim())
        .forEach((s, i) => {
          fd.append(`specifications[${i}][key]`, s.key);
          fd.append(`specifications[${i}][value]`, s.value);
        });

      if (id) {
        fd.append("_method", "PUT");
        await api.upload(`api/products/${id}`, fd);
        notify.success("Product Updated Successfully");
      } else {
        await api.upload("api/products", fd);
        notify.success("Product Created Successfully");
      }
      window.location.href = "/dashboard/products";
    } catch (err) {
      notify.error(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const colorImg = (i, file) =>
    setColors((list) => {
      const next = clone(list);
      next[i] = { ...next[i], image: file };
      return next;
    });

  const sizeOptions = useMemo(() => sizeList, [sizeList]);

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
                    <option value="in-stock">In Stock</option>
                    <option value="prebook">Prebook</option>
                    <option value="sold">Sold</option>
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
                      className={`badge border px-3 py-2 ${
                        on ? "bg-primary text-white" : "bg-light text-dark"
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
                    <select
                      className="form-select"
                      value={s.size_id || ""}
                      onChange={(e) => rowSet(setSizes)(i, "size_id", e.target.value)}
                    >
                      <option value="">-- Select Size --</option>
                      {sizeOptions.map((sz) => (
                        <option key={sz.id} value={sz.id}>
                          {sz.size}
                        </option>
                      ))}
                    </select>
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
                >
                  <FaPlus />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) setImages((l) => [...l, ...files]);
                    e.target.value = "";
                  }}
                />
              </div>
              <small className="text-muted">
                Click + to add product photos. First image is the cover.
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
