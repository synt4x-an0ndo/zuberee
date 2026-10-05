"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { api } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

/**
 * Shop page.
 *  - Filter options: GET api/shop/filters   (categories / sizes / price_range)
 *  - Products:       GET api/shop/products?page=&categories[]=&sizes[]=
 *                                      &min_price=&max_price=&search=
 */
export default function ShopPage() {
  const [options, setOptions] = useState(null);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [priceInput, setPriceInput] = useState({ min: "", max: "" });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstLoad = useRef(true);

  /* ---------- load filter options once ---------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/shop/filters");
        const data = r?.data || {};
        setOptions(data);
        setFilters({
          categories: [],
          sizes: [],
          min_price: data.price_range?.min ?? "",
          max_price: data.price_range?.max ?? "",
          search: "",
        });
        setPriceInput({
          min: data.price_range?.min ?? "",
          max: data.price_range?.max ?? "",
        });
      } catch {
        setOptions({ categories: [], sizes: [], price_range: { min: 0, max: 0 } });
        setFilters({ categories: [], sizes: [], min_price: "", max_price: "", search: "" });
      }
    })();
  }, []);

  /* ---------- fetch products whenever filters change ---------- */
  const fetchProducts = useCallback(
    async (page = 1, append = false) => {
      if (!filters) return;
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const qs = new URLSearchParams({ page: String(page) });
        filters.categories.forEach((c) => qs.append("categories[]", c));
        filters.sizes.forEach((s) => qs.append("sizes[]", s));
        if (filters.min_price !== "" && filters.min_price != null)
          qs.append("min_price", filters.min_price);
        if (filters.max_price !== "" && filters.max_price != null)
          qs.append("max_price", filters.max_price);
        if (filters.search) qs.append("search", filters.search);
        const r = await api.get(`api/shop/products?${qs.toString()}`);
        const pageData = r?.data && !Array.isArray(r.data) ? r.data : r;
        const list = Array.isArray(pageData?.data) ? pageData.data : [];
        setProducts((prev) => (append ? [...(prev || []), ...list] : list));
        setPagination(
          pageData && typeof pageData === "object"
            ? { ...pageData, has_more: pageData.current_page < pageData.last_page }
            : null
        );
      } catch {
        notify.error("Error loading products");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    if (!filters) return;
    if (firstLoad.current) {
      firstLoad.current = false;
    }
    fetchProducts(1, false);
  }, [filters, fetchProducts]);

  /* ---------- debounced inputs ---------- */
  useEffect(() => {
    if (!filters) return;
    const t = setTimeout(() => {
      if (searchInput.length >= 3 || searchInput.length === 0) {
        setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      }
    }, 800);
    return () => clearTimeout(t);
  }, [searchInput, filters]);

  useEffect(() => {
    if (!filters) return;
    const t = setTimeout(() => {
      setFilters((f) =>
        f.min_price === priceInput.min && f.max_price === priceInput.max
          ? f
          : { ...f, min_price: priceInput.min, max_price: priceInput.max }
      );
    }, 400);
    return () => clearTimeout(t);
  }, [priceInput, filters]);

  const toggle = (key, value) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }));

  if (!filters || !options) return <Loader />;

  const activeCount = filters.categories.length + filters.sizes.length;

  return (
    <div className="container py-4">
      <h4 className="fw-bold mb-4" style={{ color: "var(--primary-color)" }}>
        Shop
      </h4>

      <div className="row">
        {/* ============ FILTERS SIDEBAR ============ */}
        <div className="col-lg-3 mb-4">
          <div className="border rounded p-3 bg-white">
            {/* search */}
            <div className="mb-4">
              <div className="fw-semibold mb-2" style={{ fontSize: 14 }}>
                Search
              </div>
              <input
                className="form-control form-control-sm"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput.length > 0 && searchInput.length < 3 && (
                <p className="spf-hint small text-muted mt-1 mb-0">
                  Type at least 3 characters
                </p>
              )}
            </div>

            {/* categories */}
            <FilterSection
              title="Category"
              count={filters.categories.length}
              defaultOpen
            >
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {options.categories.map((c) => (
                  <label key={c.id} className="d-flex align-items-center gap-2 py-1" style={{ fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(c.id)}
                      onChange={() => toggle("categories", c.id)}
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
                {options.categories.length === 0 && (
                  <span className="text-muted small">No categories</span>
                )}
              </div>
            </FilterSection>

            {/* sizes */}
            <FilterSection title="Size" count={filters.sizes.length}>
              <div className="d-flex flex-wrap gap-1">
                {options.sizes.map((s) => (
                  <button
                    key={s.id ?? s.size}
                    type="button"
                    className="btn btn-sm border"
                    style={{
                      fontSize: 12,
                      background: filters.sizes.includes(String(s.id ?? s.size))
                        ? "var(--primary-color)"
                        : "#fff",
                      color: filters.sizes.includes(String(s.id ?? s.size))
                        ? "#fff"
                        : "#333",
                    }}
                    onClick={() => toggle("sizes", String(s.id ?? s.size))}
                  >
                    {s.size}
                  </button>
                ))}
              </div>
            </FilterSection>

            {/* price */}
            <FilterSection title="Price">
              <div className="d-flex gap-2 align-items-center">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder={String(options.price_range?.min ?? 0)}
                  value={priceInput.min}
                  onChange={(e) =>
                    setPriceInput((p) => ({ ...p, min: e.target.value }))
                  }
                />
                <span>-</span>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder={String(options.price_range?.max ?? 0)}
                  value={priceInput.max}
                  onChange={(e) =>
                    setPriceInput((p) => ({ ...p, max: e.target.value }))
                  }
                />
              </div>
              <div className="text-muted small mt-1">
                Range: {options.price_range?.min}৳ - {options.price_range?.max}৳
              </div>
            </FilterSection>

            {activeCount > 0 && (
              <button
                className="btn btn-outline-secondary btn-sm w-100 mt-3"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    categories: [],
                    sizes: [],
                    min_price: options.price_range?.min ?? "",
                    max_price: options.price_range?.max ?? "",
                    search: "",
                  }))
                }
              >
                Clear filters ({activeCount})
              </button>
            )}
          </div>
        </div>

        {/* ============ PRODUCT GRID ============ */}
        <div className="col-lg-9">
          {loading ? (
            <Loader />
          ) : products.length === 0 ? (
            <div className="text-center py-5 text-muted">No products found</div>
          ) : (
            <>
              <div className="row mx-0">
                {products.map((p, i) => (
                  <div key={`${p.id}-${i}`} className="col-6 col-md-4 px-1 px-md-2 mb-3">
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
                  <div className="text-muted small mt-2">
                    Page {pagination.current_page} of {pagination.last_page} •{" "}
                    {pagination.total} products
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Collapsible filter section (same behaviour as original) */
function FilterSection({ title, count = 0, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 border-bottom pb-3">
      <button
        type="button"
        className="d-flex align-items-center justify-content-between w-100 border-0 bg-transparent p-0 fw-semibold"
        style={{ fontSize: 14 }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {title}
          {count > 0 && <span className="text-muted fw-normal"> ({count})</span>}
        </span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: ".2s" }}>
          ▾
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
