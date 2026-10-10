"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { api, imgUrl, unwrapList } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";
import "@/styles/css/b2790d3f6ef2e460.css";

/**
 * Category / collection listing page (/[category])
 *  - Products : GET api/products?category={slug}
 *  - Filters  : derived from the product response because the backend exposes
 *               no separate category-filter endpoint.
 *
 * NOTE: `params` arrives as a Promise in Next 14 client components -> unwrap
 * with React.use().
 */
export default function CategoryPage({ params }) {
  const { category } = use(params);

  const [allProducts, setAllProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [activeSizes, setActiveSizes] = useState([]);
  const [activeColors, setActiveColors] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [meta, setMeta] = useState(null); // first response (category id/name)

  const buildQuery = useCallback(
    (page) => {
      const qs = new URLSearchParams({ category });
      return qs.toString();
    },
    [category]
  );

  const fetchProducts = useCallback(
    async (page = 1, append = false) => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const r = await api.get(`api/products?${buildQuery(page)}`, { auth: false });
        const list = unwrapList(r, ["products"]);
        setAllProducts((prev) => (append ? [...prev, ...list] : list));
        setPagination({ total: list.length, current_page: 1, last_page: 1, has_more: false });
        if (list[0]?.category?.[0]) setMeta(list[0].category[0]);
      } catch {
        notify.error("Failed to load products");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery]
  );

  /* products (refetch on any filter change) */
  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  const filters = useMemo(() => {
    const sizes = new Map();
    const colors = new Map();
    allProducts.forEach((product) => {
      (product.sizes || []).forEach((variant) => {
        const size = String(variant.size ?? "");
        if (!size) return;
        const current = sizes.get(size) || { id: variant.id, size, available: 0 };
        current.available += Number(variant.pivot?.stock) || 0;
        sizes.set(size, current);
      });
      (product.colors || []).forEach((color) => {
        if (!color.name) return;
        const current = colors.get(color.name) || {
          name: color.name,
          code: color.code,
          image: color.image,
          available: 0,
        };
        current.available += Number(product.stock) || 0;
        colors.set(color.name, current);
      });
    });
    return { category: meta, sizes: [...sizes.values()], colors: [...colors.values()] };
  }, [allProducts, meta]);

  const products = useMemo(() => allProducts.filter((product) => {
    const matchesSize = !activeSizes.length || (product.sizes || []).some((size) =>
      activeSizes.includes(String(size.size))
    );
    const matchesColor = !activeColors.length || (product.colors || []).some((color) =>
      activeColors.includes(color.name)
    );
    const matchesStock = !inStockOnly || product.status === "in-stock" ||
      (product.sizes || []).some((size) => Number(size.pivot?.stock) > 0);
    return matchesSize && matchesColor && matchesStock;
  }), [activeColors, activeSizes, allProducts, inStockOnly]);

  const toggle = (list, setList, value) =>
    setList((arr) =>
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
    );

  const hasFilters =
    activeSizes.length > 0 || activeColors.length > 0 || inStockOnly;

  return (
    <div className="container py-4">
      {/* heading */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0" style={{ color: "var(--primary-color)" }}>
          {filters?.category?.name || category.replace(/-/g, " ")}
        </h4>
        {pagination?.total != null && (
          <span className="text-muted small">{pagination.total} products</span>
        )}
      </div>

      {/* -------- filter bar -------- */}
      <div className="border rounded bg-white p-3 mb-4">
        <div className="row g-3 align-items-end">
          {/* sizes */}
          <div className="col-md-5">
            <div className="fw-semibold small mb-2">
              Size
              <span className="text-muted fw-normal ms-2">
                Stock available in size
              </span>
            </div>
            <div className="d-flex flex-wrap gap-1">
              {(filters?.sizes || []).map((s) => {
                const active = activeSizes.includes(String(s.size));
                const out = (s.available ?? 0) <= 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="btn btn-sm border"
                    disabled={out}
                    title={out ? "Sold out" : `${s.available} available`}
                    style={{
                      minWidth: 44,
                      fontSize: 12,
                      opacity: out ? 0.45 : 1,
                      background: active ? "var(--primary-color)" : "#fff",
                      color: active ? "#fff" : "#333",
                    }}
                    onClick={() => toggle(activeSizes, setActiveSizes, String(s.size))}
                  >
                    {s.size}
                  </button>
                );
              })}
              {(filters?.sizes || []).length === 0 && (
                <span className="text-muted small">No sizes</span>
              )}
            </div>
          </div>

          {/* colors */}
          <div className="col-md-5">
            <div className="fw-semibold small mb-2">Colour</div>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm border"
                style={{
                  fontSize: 12,
                  background: activeColors.length === 0 ? "var(--primary-color)" : "#fff",
                  color: activeColors.length === 0 ? "#fff" : "#333",
                }}
                onClick={() => setActiveColors([])}
              >
                All colours
              </button>
              {(filters?.colors || []).map((c, i) => {
                const active = activeColors.includes(c.name);
                const out = (c.available ?? 0) <= 0;
                const key = `${c.name}-${i}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`color-mini-swatch btn btn-sm border d-flex align-items-center gap-1 ${active ? "bg-light" : ""} ${out ? "opacity-50" : ""}`}
                    style={{
                      borderColor: active ? "var(--primary-color)" : "#dee2e6",
                      fontSize: 11,
                    }}
                    onClick={() => toggle(activeColors, setActiveColors, c.name)}
                    title={out ? "Sold out" : `${c.available} available`}
                  >
                    <span
                      className="color-mini-swatch-circle rounded-circle d-inline-block"
                      style={{
                        width: 14,
                        height: 14,
                        background: c.image ? `url(${imgUrl(c.image)}) center/cover` : c.code || "#d0d5dd",
                        border: "1px solid #ccc",
                      }}
                    />
                    <span className="color-mini-name">{c.name}</span>
                    {out && <span className="text-muted">(Sold out)</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* stock toggle + actions */}
          <div className="col-md-2 text-md-end">
            <label className="d-flex align-items-center gap-2 small justify-content-md-end mb-2">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              In stock only
            </label>
            <div className="d-flex gap-2 justify-content-md-end">
              {hasFilters && (
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => {
                    setActiveSizes([]);
                    setActiveColors([]);
                    setInStockOnly(false);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -------- products -------- */}
      {loading ? (
        <Loader />
      ) : products.length === 0 ? (
        <div className="text-center py-5 text-muted">No products found</div>
      ) : (
        <>
          <div className="row mx-0">
            {products.map((p, i) => (
              <div key={`${p.id}-${i}`} className="col-6 col-md-4 col-lg-3 px-1 px-md-2 mb-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>

          {pagination?.has_more && (
            <div className="text-center my-4">
              <button
                className="slot-loadmore-btn"
                disabled={loadingMore}
                onClick={() => fetchProducts((pagination.current_page || 1) + 1, true)}
              >
                {loadingMore ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
