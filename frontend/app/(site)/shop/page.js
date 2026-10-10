"use client";

import { useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { api, unwrapList } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

/**
 * Shop page.
 *  - Categories: GET api/categories
 *  - Products:   GET api/products
 */
export default function ShopPage() {
  const [options, setOptions] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [priceInput, setPriceInput] = useState({ min: "", max: "" });
  const [loading, setLoading] = useState(true);
  const [loadingMore] = useState(false);

  /* ---------- load filter options once ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [categoriesResponse, productsResponse] = await Promise.all([
          api.get("api/categories", { auth: false }),
          api.get("api/products", { auth: false }),
        ]);
        const categories = unwrapList(categoriesResponse, ["categories"]);
        const loadedProducts = unwrapList(productsResponse, ["products"]);
        setAllProducts(loadedProducts);
        const sizes = [...new Map(
          loadedProducts.flatMap((product) => product.sizes || [])
            .map((size) => [String(size.size), { id: size.id, size: String(size.size) }])
        ).values()];
        const prices = loadedProducts.map((product) => Number(product.price)).filter(Number.isFinite);
        const priceRange = {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        };
        const data = { categories, sizes, price_range: priceRange };
        setOptions(data);
        setFilters({
          categories: [],
          sizes: [],
          min_price: priceRange.min,
          max_price: priceRange.max,
          search: "",
        });
      } catch {
        setOptions({ categories: [], sizes: [], price_range: { min: 0, max: 0 } });
        setFilters({ categories: [], sizes: [], min_price: "", max_price: "", search: "" });
      }
    })();
  }, []);

  useEffect(() => {
    if (!filters) return;
    const query = filters.search.trim().toLowerCase();
    const min = filters.min_price === "" ? -Infinity : Number(filters.min_price);
    const max = filters.max_price === "" ? Infinity : Number(filters.max_price);
    const filtered = allProducts.filter((product) => {
      const categoryIds = (product.category || []).map((category) => category.id);
      const sizes = (product.sizes || []).map((size) => String(size.size));
      const text = `${product.title || ""} ${product.sku || ""}`.toLowerCase();
      return (!filters.categories.length || filters.categories.some((id) => categoryIds.includes(id)))
        && (!filters.sizes.length || filters.sizes.some((size) => sizes.includes(size)))
        && (!query || text.includes(query))
        && Number(product.price) >= min
        && Number(product.price) <= max;
    });
    setProducts(filtered);
    setPagination({ current_page: 1, last_page: 1, total: filtered.length, has_more: false });
    setLoading(false);
  }, [allProducts, filters]);

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
