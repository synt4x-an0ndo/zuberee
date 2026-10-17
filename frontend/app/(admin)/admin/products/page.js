"use client";

import ViewportPortal from "@/components/ViewportPortal";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiEye, FiList, FiPlus, FiSearch, FiTrash2, FiVideo, FiX } from "react-icons/fi";
import Img from "@/components/Img";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import { Badge, Button, EmptyState, ErrorState, Input, Select, Skeleton } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { api, formatMoney, listOf } from "@/lib/api";
import { normalizeProduct } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const STATUS_TONE = { "in-stock": "success", "out-of-stock": "danger", "pre-order": "info", discontinued: "neutral" };
const STATUS_LABEL = { "in-stock": "In stock", "out-of-stock": "Out of stock", "pre-order": "Pre-order", discontinued: "Discontinued" };

export default function ProductsPage() {
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [specProduct, setSpecProduct] = useState(null);

  const { data, loading, error, reload, setData } = useAsync(async () => {
    const body = await api.get("api/products", { auth: false });
    return listOf(body).map(normalizeProduct).filter(Boolean);
  }, []);

  useEffect(() => {
    if (!specProduct) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSpecProduct(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [specProduct]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((p) => {
      if (q && !`${p.title} ${p.sku}`.toLowerCase().includes(q)) return false;
      if (status && p.status !== status) return false;
      return true;
    });
  }, [data, search, status]);

  const remove = async (product) => {
    const ok = await confirm({ title: "Delete this product?", message: `"${product.title}" and its photos, sizes and colours will be removed. This cannot be undone.`, confirmText: "Delete product", danger: true });
    if (!ok) return;
    try {
      await api.delete(`api/products/${product.id}`);
      setData((data || []).filter((p) => p.id !== product.id));
      toast.success("Product deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        title="Products"
        subtitle={<span>Manage your product catalog <strong className="count-pill">{data?.length ?? "—"} total</strong></span>}
        actions={<Button href="/admin/products/new" variant="primary"><FiPlus aria-hidden="true" /> Add Product</Button>}
      />

      <div className="card card-pad product-toolbar" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
          <Input aria-label="Search products" placeholder="Search by product name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <Select aria-label="Filter by status" placeholder="All Status" value={status} onChange={(e) => setStatus(e.target.value)} options={[
          { value: "in-stock", label: "In Stock" },
          { value: "pre-order", label: "Prebook" },
          { value: "out-of-stock", label: "Sold" },
        ]} style={{ flex: "0 1 180px" }} />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton style={{ height: 400 }} />
      ) : rows.length === 0 ? (
        <EmptyState title={data.length ? "No products match" : "No products yet"} text={data.length ? "Try a different search or filter." : "Add your first product to start selling."} action={<Button href="/admin/products/new" variant="primary">Add product</Button>} />
      ) : (
        <DataTable className="products-reference-table">
          <thead><tr>{["#", "Image", "Product Info", "SKU", "Colors", "Status", "Categories", "Pricing & Variants", "Specs", "FAQ", "Video", "Actions"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((p, index) => (
              <tr key={p.id}>
                <td className="num">{index + 1}</td>
                <td>
                  <div className="product-reference-image">{p.image && <Img src={p.image} alt="" fill sizes="52px" />}</div>
                </td>
                <td><div className="product-info-cell">
                  <strong>{p.title}</strong>
                  <span className="muted">Created: —</span>
                  <span className="price-now">Discount: {formatMoney(p.salePrice)}</span>
                  <span className="badge badge-warn">ID: {p.id}</span>
                </div></td>
                <td><span className="badge badge-neutral">{p.sku || "—"}</span></td>
                <td>
                  <div className="product-color-list">
                    {p.colors.length ? p.colors.map((color) => <span key={color.id || color.name} className="product-color"><span className="product-color-image">{color.image && <Img src={color.image} alt="" fill sizes="34px" />}</span>{color.name}</span>) : "—"}
                  </div>
                </td>
                <td><Badge tone={STATUS_TONE[p.status] || "neutral"}>{STATUS_LABEL[p.status] || p.status}</Badge></td>
                <td><div className="product-category-list">{p.category?.name ? <span className="badge badge-info">{p.category.name}</span> : "—"}</div></td>
                <td>
                  <div className="variant-list">
                    {p.sizes.slice(0, 3).map((size) => <span key={size.id || size.label}><span className="badge badge-neutral">{size.label}</span> → <span className="muted">({size.stock} stock)</span></span>)}
                    {p.sizes.length > 3 && <Button size="sm" variant="outline"><FiEye aria-hidden="true" /> View all</Button>}
                    <span className="price-base">Base Price: {formatMoney(p.price)}</span>
                  </div>
                </td>
                <td><button type="button" className="icon-badge product-spec-trigger" aria-haspopup="dialog" aria-label={`View specifications for ${p.title}`} onClick={() => setSpecProduct(p)}><FiList aria-hidden="true" /> <span>{p.specifications.length}</span></button></td>
                <td className="muted">—</td>
                <td className="muted">{p.videoUrl ? <FiVideo aria-label="Video available" /> : "—"}</td>
                <td>
                  <div className="product-actions">
                    <Link href={`/admin/products/${p.id}`} className="icon-btn" aria-label={`Edit ${p.title}`}><FiEdit2 aria-hidden="true" /></Link>
                    <button type="button" className="icon-btn" aria-label={`Delete ${p.title}`} onClick={() => remove(p)}><FiTrash2 aria-hidden="true" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {specProduct && (
        <ViewportPortal>
        <div className="product-spec-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSpecProduct(null)}>
          <section className="product-spec-modal" role="dialog" aria-modal="true" aria-labelledby="product-spec-title">
            <header className="product-spec-modal-header">
              <div className="product-spec-modal-heading">
                <div className="product-spec-product-image">
                  {specProduct.image ? <Img src={specProduct.image} alt="" fill sizes="56px" /> : <FiList aria-hidden="true" />}
                </div>
                <div className="product-spec-modal-title-copy">
                  <span className="product-spec-eyebrow">Product details</span>
                  <h2 id="product-spec-title">Specifications</h2>
                  <p>{specProduct.title}</p>
                </div>
              </div>
              <button type="button" className="product-spec-modal-close" onClick={() => setSpecProduct(null)} aria-label="Close specifications"><FiX aria-hidden="true" /></button>
            </header>
            <div className="product-spec-modal-body">
              {specProduct.specifications.length > 0 ? (
                <dl className="product-spec-grid">
                  {specProduct.specifications.map((spec, index) => (
                    <div className="product-spec-item" key={`${spec.key || "spec"}-${index}`}>
                      <dt>{spec.key || `Specification ${index + 1}`}</dt>
                      <dd>{spec.value || "\u2014"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="product-spec-empty">
                  <span className="product-spec-empty-icon"><FiList aria-hidden="true" /></span>
                  <strong>No specifications added</strong>
                  <p>Add product details from the edit product page and they will appear here.</p>
                </div>
              )}
            </div>
            <footer className="product-spec-modal-footer">
              <span>{specProduct.specifications.length} {specProduct.specifications.length === 1 ? "detail" : "details"}</span>
              <button type="button" className="product-spec-modal-done" onClick={() => setSpecProduct(null)}>Done</button>
            </footer>
          </section>
        </div>
        </ViewportPortal>
      )}
    </div>
  );
}
