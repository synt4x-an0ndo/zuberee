"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { api, imgUrl, normalizedProductStatus, productColors, unwrapList } from "@/lib/api";
import Loader from "@/components/Loader";
import "@/styles/css/b2790d3f6ef2e460.css";

/**
 * Category / collection listing page (/[category])
 *  - Products : GET api/products?category={slug}
 *  - Filters  : derived from the product response because the backend exposes
 *               no separate category-filter endpoint.
 * The route slug is read with Next.js useParams(), which is compatible with
 * this app's React 18 runtime and avoids depending on React 19's `use` hook.
 */
export default function CategoryPage() {
  const { category } = useParams();

  const [allProducts, setAllProducts] = useState([]);
  const [activeSizes, setActiveSizes] = useState([]);
  const [activeColors, setActiveColors] = useState([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(24);
  const [loadError, setLoadError] = useState("");
  const [meta, setMeta] = useState(null);
  const requestId = useRef(0);

  const fetchProducts = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const query = category
        ? `?${new URLSearchParams({ category }).toString()}`
        : "";
      const response = await api.get(`api/products?${query}`, { auth: false });
      if (currentRequestId !== requestId.current) return;
      const list = unwrapList(response, ["products"]);
      setAllProducts(list);
      const categoryRecord = list.find((product) => product.category?.[0])?.category?.[0];
      setMeta(categoryRecord || null);
    } catch (error) {
      if (currentRequestId !== requestId.current) return;
      setLoadError(error?.message || "Products could not be loaded.");
      setAllProducts([]);
      setMeta(null);
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchProducts();
    return () => { requestId.current += 1; };
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
      productColors(product).forEach((color) => {
        if (!color.name) return;
        const current = colors.get(color.name) || {
          name: color.name,
          code: color.code,
          image: color.image,
          available: 0,
        };
        const available = (product.sizes || []).some((size) => Number(size.pivot?.stock) > 0) ||
          normalizedProductStatus(product) === "in-stock";
        current.available += available ? 1 : 0;
        colors.set(color.name, current);
      });
    });
    return { category: meta, sizes: [...sizes.values()], colors: [...colors.values()] };
  }, [allProducts, meta]);

  const products = useMemo(() => allProducts.filter((product) => {
    const matchesSize = !activeSizes.length || (product.sizes || []).some((size) =>
      activeSizes.includes(String(size.size))
    );
    const matchesColor = !activeColors.length || productColors(product).some((color) =>
      activeColors.includes(color.name)
    );
    const matchesStock = !inStockOnly || normalizedProductStatus(product) === "in-stock" ||
      (product.sizes || []).some((size) => Number(size.pivot?.stock) > 0);
    return matchesSize && matchesColor && matchesStock;
  }), [activeColors, activeSizes, allProducts, inStockOnly]);

  useEffect(() => {
    setVisibleCount(24);
  }, [activeSizes, activeColors, inStockOnly, category]);

  const toggle = (setList, value) =>
    setList((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    );

  const hasFilters = activeSizes.length > 0 || activeColors.length > 0 || inStockOnly;
  const canLoadMore = visibleCount < products.length;
  const loadMore = () => setVisibleCount((count) => Math.min(count + 24, products.length));

  return (
    <div className="container py-4">
      {/* heading */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0" style={{ color: "var(--primary-color)" }}>
          {filters?.category?.name || category.replace(/-/g, " ")}
        </h4>
        {!loading && <span className="text-muted small">{products.length} products</span>}
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
                    onClick={() => toggle(setActiveSizes, String(s.size))}
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
                const swatchImage = imgUrl(c.image);
                const swatchCode = /^#[\da-f]{3,8}$/i.test(String(c.code || "")) ? c.code : "#d0d5dd";
                return (
                  <button
                    key={key}
                    type="button"
                    className={`color-mini-swatch btn btn-sm border d-flex align-items-center gap-1 ${active ? "bg-light" : ""} ${out ? "opacity-50" : ""}`}
                    disabled={out}
                    aria-pressed={active}
                    style={{
                      borderColor: active ? "var(--primary-color)" : "#dee2e6",
                      fontSize: 11,
                    }}
                    onClick={() => toggle(setActiveColors, c.name)}
                    aria-label={`Filter by ${c.name}${out ? ", sold out" : ""}`}
                    title={out ? "Sold out" : `${c.available} available`}
                  >
                    <span
                      className="color-mini-swatch-circle rounded-circle d-inline-block"
                      style={{
                        width: 14,
                        height: 14,
                        backgroundColor: swatchCode,
                        border: "1px solid #ccc",
                      }}
                    >
                      {swatchImage && <img src={swatchImage} alt="" loading="lazy" />}
                    </span>
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
      ) : loadError && allProducts.length === 0 ? (
        <div className="empty-state text-center py-5">
          <p className="text-muted">{loadError}</p>
          <button type="button" className="btn btn-outline-secondary" onClick={() => fetchProducts(1)}>
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state text-center py-5">
          <h2 className="h5">No products found</h2>
          <p className="text-muted mb-0">Try changing or clearing your filters.</p>
        </div>
      ) : (
        <>
          <div className="row mx-0">
            {products.slice(0, visibleCount).map((product, index) => (
              <div key={`${product.id}-${index}`} className="col-6 col-md-4 col-lg-3 px-1 px-md-2 mb-3">
                <ProductCard product={product} />
              </div>
            ))}
          </div>

          {canLoadMore && (
            <div className="text-center my-4">
              <button
                type="button"
                className="slot-loadmore-btn"
                onClick={loadMore}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
