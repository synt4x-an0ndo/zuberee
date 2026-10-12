"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { api, unwrapList } from "@/lib/api";
import Loader from "@/components/Loader";

const PAGE_SIZE = 24;

export default function ShopPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const querySearch = searchParams.get("search")?.trim() || "";
  const [options, setOptions] = useState(null);
  // Server-side filters sent to /api/product-pagination (documented contract).
  const [filters, setFilters] = useState(null); // { category, search, min_price, max_price }
  const [sizeFilter, setSizeFilter] = useState([]); // client-side only (no API support)
  const [searchInput, setSearchInput] = useState(querySearch);
  const [priceInput, setPriceInput] = useState({ min: "", max: "" });

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const requestId = useRef(0);

  /* Build the documented /api/product-pagination query for a given page. */
  const buildParams = useCallback((pageNumber) => {
    const params = new URLSearchParams({ page: String(pageNumber), per_page: String(PAGE_SIZE) });
    if (!filters) return params;
    if (filters.category) params.set("category", filters.category);
    if (filters.search) params.set("search", filters.search);
    if (filters.min_price !== "") params.set("min_price", filters.min_price);
    if (filters.max_price !== "") params.set("max_price", filters.max_price);
    return params;
  }, [filters]);

  /* ---- initial load: categories + full product list for the filter options ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [categoriesResponse, productsResponse] = await Promise.all([
          api.get("api/categories", { auth: false }),
          api.get("api/products", { auth: false }),
        ]);
        if (!alive) return;

        const categories = flattenCategories(unwrapList(categoriesResponse, ["categories"]));
        const allProducts = unwrapList(productsResponse, ["products"]);
        const sizes = [...new Set(
          allProducts.flatMap((product) => (product.sizes || []).map((size) => String(size.size || "")))
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        // The backend price filter (see /api/product-pagination) operates on the
        // base product price, so the range is derived from product.price to stay
        // aligned with the documented contract.
        const prices = allProducts
          .map((product) => Number(product.price))
          .filter((price) => Number.isFinite(price));
        const priceRange = {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        };

        setOptions({ categories, sizes, price_range: priceRange });
        setPriceInput({ min: String(priceRange.min), max: String(priceRange.max) });
        setFilters({
          category: "",
          search: querySearch,
          min_price: String(priceRange.min),
          max_price: String(priceRange.max),
        });
      } catch (cause) {
        if (!alive) return;
        setError(cause?.message || "The shop could not be loaded.");
        setOptions({ categories: [], sizes: [], price_range: { min: 0, max: 0 } });
        setFilters({ category: "", search: querySearch, min_price: "", max_price: "" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [querySearch]);

  useEffect(() => {
    setSearchInput(querySearch);
    setFilters((current) => current ? { ...current, search: querySearch } : current);
  }, [querySearch]);

  useEffect(() => {
    if (!filters) return undefined;
    const timer = window.setTimeout(() => {
      const query = searchInput.trim();
      setFilters((current) => current && current.search !== query
        ? { ...current, search: query }
        : current
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters]);

  useEffect(() => {
    if (!filters) return undefined;
    const timer = window.setTimeout(() => {
      setFilters((current) => current && (
        current.min_price !== priceInput.min || current.max_price !== priceInput.max
      ) ? { ...current, min_price: priceInput.min, max_price: priceInput.max } : current);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [priceInput, filters]);

  /* ---- fetch page 1 whenever the server-side filters change ---- */
  useEffect(() => {
    if (!options || !filters) return undefined;
    const currentRequestId = ++requestId.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await api.get(`api/product-pagination?${buildParams(1).toString()}`, {
          auth: false,
          signal: controller.signal,
        });
        if (currentRequestId !== requestId.current) return;
        setProducts(unwrapList(response, ["products", "results"]));
        setMeta(response?.meta || null);
        setPage(1);
      } catch (cause) {
        if (cause?.name === "AbortError" || currentRequestId !== requestId.current) return;
        setError(cause?.message || "The shop could not be loaded.");
        setProducts([]);
        setMeta(null);
      } finally {
        if (currentRequestId === requestId.current) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [buildParams, filters, options]);

  /* ---- "Load more": fetch the next page and append it ---- */
  const loadMore = async () => {
    if (!meta || !meta.has_more || loadingMore || loading) return;
    const nextPage = page + 1;
    const capturedRequestId = requestId.current;
    setLoadingMore(true);
    try {
      const response = await api.get(`api/product-pagination?${buildParams(nextPage).toString()}`, {
        auth: false,
      });
      // Drop the result if a filter/search change started a newer request meanwhile.
      if (capturedRequestId !== requestId.current) return;
      setProducts((current) => [...current, ...unwrapList(response, ["products", "results"])]);
      setMeta(response?.meta || meta);
      setPage(nextPage);
    } catch (cause) {
      setError(cause?.message || "Could not load more products.");
    } finally {
      if (capturedRequestId === requestId.current) setLoadingMore(false);
    }
  };

  /* Size filter is a client-side refinement over the paginated results. */
  const displayProducts = useMemo(() => {
    if (!sizeFilter.length) return products;
    return products.filter((product) =>
      (product.sizes || []).some((size) => sizeFilter.includes(String(size.size)))
    );
  }, [products, sizeFilter]);

  const selectCategory = (slug) =>
    setFilters((current) => (current ? { ...current, category: current.category === slug ? "" : slug } : current));

  const toggleSize = (size) =>
    setSizeFilter((current) => (current.includes(size) ? current.filter((item) => item !== size) : [...current, size]));

  const clearFilters = () => {
    const priceRange = options?.price_range || { min: 0, max: 0 };
    setSearchInput("");
    setPriceInput({ min: String(priceRange.min), max: String(priceRange.max) });
    setSizeFilter([]);
    setFilters((current) => (current ? {
      ...current,
      category: "",
      search: "",
      min_price: String(priceRange.min),
      max_price: String(priceRange.max),
    } : current));
  };

  const activeCount = (filters?.category ? 1 : 0)
    + (filters?.search ? 1 : 0)
    + sizeFilter.length
    + (priceInput.min !== String(options?.price_range?.min ?? 0) || priceInput.max !== String(options?.price_range?.max ?? 0) ? 1 : 0);

  return (
    <section className="shop-page container py-4 py-lg-5">
      <div className="shop-heading d-flex align-items-end justify-content-between flex-wrap gap-3 mb-4">
        <div>
          <p className="shop-eyebrow mb-1">Curated for your everyday</p>
          <h1 className="h2 fw-bold mb-0">Shop all</h1>
        </div>
        {!loading && <span className="shop-result-count">{meta?.total ?? displayProducts.length} products</span>}
      </div>

      {loading || !options || !filters ? (
        <Loader />
      ) : error && products.length === 0 ? (
        <div className="empty-state text-center py-5">
          <h2 className="h5">Shop is temporarily unavailable</h2>
          <p className="text-muted mb-0">{error}</p>
          <button type="button" className="btn btn-outline-secondary mt-3" onClick={() => setFilters({ ...filters })}>
            Try again
          </button>
        </div>
      ) : (
        <div className="row g-4">
          <aside className="col-lg-3">
            <div className="shop-filter-panel">
              <div className="shop-filter-heading d-flex justify-content-between align-items-center mb-3">
                <h2 className="h6 fw-bold mb-0">Filters</h2>
                {activeCount > 0 && (
                  <button type="button" className="shop-clear-button" onClick={clearFilters}>
                    Clear all
                  </button>
                )}
              </div>

              <label className="shop-field-label" htmlFor="shop-search">Search</label>
              <input
                id="shop-search"
                className="form-control shop-search-input mb-3"
                type="search"
                placeholder="Product name or SKU"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />

              <FilterSection title="Category" count={filters.category ? 1 : 0} defaultOpen>
                <div className="shop-category-options">
                  {options.categories.map((category) => (
                    <label key={category.id} className="shop-checkbox-row">
                      <input
                        type="checkbox"
                        checked={filters.category === category.slug}
                        onChange={() => selectCategory(category.slug)}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                  {options.categories.length === 0 && <span className="text-muted small">No categories</span>}
                </div>
              </FilterSection>

              <FilterSection title="Size" count={sizeFilter.length}>
                <div className="d-flex flex-wrap gap-2">
                  {options.sizes.map((size) => {
                    const selected = sizeFilter.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`shop-size-option ${selected ? "is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleSize(size)}
                      >
                        {size}
                      </button>
                    );
                  })}
                  {options.sizes.length === 0 && <span className="text-muted small">No sizes</span>}
                </div>
              </FilterSection>

              <FilterSection title="Price">
                <div className="shop-price-fields">
                  <label>
                    <span>Min</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="form-control form-control-sm"
                      aria-label="Minimum price"
                      value={priceInput.min}
                      onChange={(event) => setPriceInput((current) => ({ ...current, min: event.target.value }))}
                    />
                  </label>
                  <span className="shop-price-separator" aria-hidden="true">to</span>
                  <label>
                    <span>Max</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="form-control form-control-sm"
                      aria-label="Maximum price"
                      value={priceInput.max}
                      onChange={(event) => setPriceInput((current) => ({ ...current, max: event.target.value }))}
                    />
                  </label>
                </div>
                <small className="text-muted d-block mt-2">
                  {options.price_range.min}৳ – {options.price_range.max}৳
                </small>
              </FilterSection>
            </div>
          </aside>

          <div className="col-lg-9">
            {displayProducts.length === 0 ? (
              <div className="empty-state text-center py-5">
                <h2 className="h5">No products match those filters</h2>
                <p className="text-muted mb-3">Try a different search or clear your filters.</p>
                <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              <>
                <div className="row mx-0 shop-product-grid">
                  {displayProducts.map((product) => (
                    <div key={product.id} className="col-6 col-md-4 px-1 px-md-2 mb-3">
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
                {meta?.has_more && (
                  <div className="text-center mt-3">
                    <button
                      type="button"
                      className="slot-loadmore-btn"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Load more products"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FilterSection({ title, count = 0, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="shop-filter-section">
      <button
        type="button"
        className="shop-filter-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}{count > 0 && <small> ({count})</small>}</span>
        <span className={`shop-filter-chevron ${open ? "is-open" : ""}`} aria-hidden="true">⌄</span>
      </button>
      {open && <div className="shop-filter-content">{children}</div>}
    </section>
  );
}

function flattenCategories(categories) {
  const flat = [];
  const visit = (items, level = 0) => {
    for (const item of items || []) {
      flat.push({ ...item, level });
      visit(item.all_children || item.children, level + 1);
    }
  };
  visit(categories);
  return flat;
}
