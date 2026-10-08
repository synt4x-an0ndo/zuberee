"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FaPlus,
  FaPen,
  FaTrash,
  FaMagnifyingGlass as FaSearch,
  FaVideo,
  FaList,
  FaCircleQuestion,
} from "react-icons/fa6";
import Swal from "sweetalert2";
import { api, imgUrl, formatTk } from "@/lib/api";
import notify from "@/components/notify";
import PageGate from "@/components/admin/PageGate";
import Loader from "@/components/Loader";

import "@/styles/css/59c72ccc8229f77b.css";
import "@/styles/css/19b7b7f3433c440d.css";

/**
 * Products admin list (/dashboard/products)
 *  - GET    api/products?search=   (Bearer auth)
 *  - DELETE api/products/{id}
 */
function ProductList() {
  const [rows, setRows] = useState([]);
  const [pager, setPager] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null); // modal product

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (query) qs.set("search", query);
      const r = await api.get(`api/products?${qs.toString()}`);
      const productRows = Array.isArray(r)
        ? r
        : Array.isArray(r?.data)
        ? r.data
        : Array.isArray(r?.data?.data)
        ? r.data.data
        : [];
      const pagerData = r?.data?.data ? r.data : r?.data || {};
      const visibleRows = productRows.filter((product) => !status || product.status === status);
      setRows(visibleRows.map((product) => ({
        ...product,
        images: Array.isArray(product.images) ? product.images : [],
        colors: Array.isArray(product.colors) ? product.colors : [],
        sizes: Array.isArray(product.sizes) ? product.sizes : [],
        category: Array.isArray(product.category) ? product.category : [],
        specifications: Array.isArray(product.specifications) ? product.specifications : [],
        faqs: Array.isArray(product.faqs) ? product.faqs : [],
      })));
      setPager({
        current_page: pagerData.current_page || 1,
        last_page: pagerData.last_page || 1,
        total: visibleRows.length,
      });
    } catch (e) {
      setError(e.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [query, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== query) {
        setPage(1);
        setQuery(search);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [search, query]);

  const remove = async (id) => {
    const res = await Swal.fire({
      title: "Delete product?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
    });
    if (!res.isConfirmed) return;
    try {
      await api.delete(`api/products/${id}`);
      notify.success("Product deleted");
      load();
    } catch (e) {
      notify.error(e.message || "Failed to delete product");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setStatus("");
    setPage(1);
  };

  return (
    <div className="inv-page p-0">
      {/* head */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-0 fw-bold">Products</h4>
          <small className="text-muted">
            {pager.total} products • create, edit and manage your catalogue
          </small>
        </div>
        <div className="d-flex gap-2">
          <Link href="/dashboard/products/add_product" className="btn btn-grad">
            <FaPlus className="me-1" /> Add Product
          </Link>
        </div>
      </div>

      {/* filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex gap-2 flex-wrap align-items-center py-3">
          <div className="input-group" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-white">
              <FaSearch />
            </span>
            <input
              className="form-control"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="pre-order">Pre-order</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="discontinued">Discontinued</option>
          </select>
          <button className="btn btn-outline-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Product Info</th>
                  <th>Sku</th>
                  <th>Colors</th>
                  <th>Status</th>
                  <th>Categories</th>
                  <th>Pricing &amp; Variants</th>
                  <th>Specs</th>
                  <th>FAQ</th>
                  <th>Video</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-4 text-muted">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Loading products...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={12} className="text-center py-4 text-danger">
                      Error: {error}
                      <button className="btn btn-sm btn-outline-danger ms-3" onClick={load}>
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-5 text-muted">
                      <FaList size={28} className="mb-2 d-block mx-auto" />
                      <b>No Products Found</b>
                      <div className="small">
                        Get started by adding your first product
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>
                        <img
                          src={imgUrl(p.images?.[0]?.image)}
                          alt=""
                          width={46}
                          height={46}
                          style={{ objectFit: "cover", borderRadius: 4, background: "#f3f3f3" }}
                        />
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div className="fw-semibold text-truncate" title={p.title}>
                          {p.title}
                        </div>
                        <small className="text-muted">
                          {p.short_description || "—"}
                        </small>
                      </td>
                      <td>
                        <code>{p.sku || "-"}</code>
                      </td>
                      <td>
                        {p.colors?.length ? (
                          <div className="d-flex gap-1 flex-wrap">
                            {p.colors.slice(0, 4).map((c) => (
                              <span
                                key={c.id}
                                className="color-circle"
                                title={`${c.name} (${c.code})`}
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: c.image
                                    ? `url(${imgUrl(c.image)}) center/cover`
                                    : c.code,
                                  border: "1px solid #ccc",
                                  display: "inline-block",
                                }}
                              />
                            ))}
                            {p.colors.length > 4 && (
                              <small className="text-muted">+{p.colors.length - 4}</small>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted small">No colors</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.status === "in-stock"
                              ? "bg-success"
                              : p.status === "prebook"
                              ? "bg-warning text-dark"
                              : "bg-secondary"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={{ maxWidth: 170 }}>
                        <small>
                          {(p.category || p.categories)?.length
                            ? (p.category || p.categories)
                                .slice(0, 2)
                                .map((c) => c.name)
                                .join(", ") +
                              ((p.category || p.categories).length > 2
                                ? ` +${(p.category || p.categories).length - 2}`
                                : "")
                            : "No categories"}
                        </small>
                      </td>
                      <td className="small">
                        <div>
                          Base Price:{" "}
                          <b>{p.price != null ? `${formatTk(p.price)}৳` : "No price set"}</b>
                        </div>
                        <div>
                          Discount:{" "}
                          <b>{p.discount ? `${formatTk(p.discount)}৳` : "-"}</b>
                        </div>
                        <div className="text-muted">
                          Total Inventory Value:{" "}
                          {p.inventory_summary
                            ? `${p.inventory_summary.available ?? 0} pcs`
                            : "—"}
                        </div>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          title="Product Specifications"
                          onClick={() => setDetail(p)}
                        >
                          <FaList />
                        </button>
                      </td>
                      <td className="text-center">
                        <FaCircleQuestion
                          className={p.faqs?.length ? "text-success" : "text-muted"}
                          title={`${p.faqs?.length || 0} FAQs`}
                        />
                      </td>
                      <td className="text-center">
                        {p.video_url ? (
                          <FaVideo className="text-success" />
                        ) : (
                          <FaVideo className="text-muted" />
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link
                            href={`/dashboard/products/edit/${p.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            <FaPen /> Edit
                          </Link>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => remove(p.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer bg-white d-flex justify-content-between align-items-center">
          <small className="text-muted">
            Page {pager.current_page} of {pager.last_page}
          </small>
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= pager.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* detail modal */}
      {detail && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100"
            style={{ background: "rgba(0,0,0,.5)", zIndex: 1040 }}
            onClick={() => setDetail(null)}
          />
          <div
            className="position-fixed start-50 top-50 translate-middle bg-white rounded shadow p-4"
            style={{ zIndex: 1050, width: "min(640px, 92vw)", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 fw-bold">{detail.title}</h5>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>

            <h6>Product Specifications</h6>
            {detail.specifications?.length ? (
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Specification</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.specifications.map((s, i) => (
                    <tr key={i}>
                      <td>{s.key}</td>
                      <td>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted small">
                No specifications available for this product
              </p>
            )}

            <h6 className="mt-3">Sizes &amp; Pricing</h6>
            {detail.sizes?.length ? (
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Price override</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.sizes.map((s) => (
                    <tr key={s.id}>
                      <td>{s.size}</td>
                      <td>{s.pivot?.price ?? "—"}</td>
                      <td>{s.pivot?.stock ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted small">No size variants configured</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductsAdminPage() {
  return (
    <PageGate permission="view products">
      <ProductList />
    </PageGate>
  );
}
