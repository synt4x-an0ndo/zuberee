"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { api, salePrice, unwrapList } from "@/lib/api";
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
  const [allProducts, setAllProducts] = useState([]);
  const [filters, setFilters] = useState(null);
  const [searchInput, setSearchInput] = useState(querySearch);
  const [priceInput, setPriceInput] = useState({ min: "", max: "" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        const loadedProducts = unwrapList(productsResponse, ["products"]);
        const sizes = [...new Set(
          loadedProducts.flatMap((product) => (product.sizes || []).map((size) => String(size.size || "")))
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const prices = loadedProducts
          .map((product) => salePrice(product))
          .filter((price) => Number.isFinite(price));
        const priceRange = {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        };

        setAllProducts(loadedProducts);
        setOptions({ categories, sizes, price_range: priceRange });
        setPriceInput({ min: String(priceRange.min), max: String(priceRange.max) });
        setFilters({
          categories: [],
          sizes: [],
          min_price: String(priceRange.min),
          max_price: String(priceRange.max),
          search: querySearch,
        });
      } catch (cause) {
        if (!alive) return;
        setError(cause?.message || "The shop could not be loaded.");
        setAllProducts([]);
        setOptions({ categories: [], sizes: [], price_range: { min: 0, max: 0 } });
        setFilters({ categories: [], sizes: [], min_price: "", max_price: "", search: querySearch });
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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const products = useMemo(() => {
    if (!filters) return [];
    const query = filters.search.trim().toLowerCase();
    const min = filters.min_price === "" ? -Infinity : Number(filters.min_price);
    const max = filters.max_price === "" ? Infinity : Number(filters.max_price);
    return allProducts.filter((product) => {
      const categoryEntries = Array.isArray(product.category)
        ? product.category
        : product.category ? [product.category] : [];
      const categoryIds = categoryEntries.map((category) => String(category?.id ?? category));
      const productSizes = (product.sizes || []).map((size) => String(size.size));
      const text = `${product.title || ""} ${product.sku || ""}`.toLowerCase();
      const price = salePrice(product);
      return (!filters.categories.length || filters.categories.some((id) => categoryIds.includes(String(id))))
        && (!filters.sizes.length || filters.sizes.some((size) => productSizes.includes(size)))
        && (!query || text.includes(query))
        && price >= min
        && price <= max;
    });
  }, [allProducts, filters]);

  const toggle = (key, value) => {
    setFilters((current) => {
      if (!current) return current;
      const selected = current[key] || [];
      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
  };

  const clearFilters = () => {
    const priceRange = options?.price_range || { min: 0, max: 0 };
    setSearchInput("");
    setPriceInput({ min: String(priceRange.min), max: String(priceRange.max) });
    setFilters({
      categories: [],
      sizes: [],
      min_price: String(priceRange.min),
      max_price: String(priceRange.max),
      search: "",
    });
  };

  const activeCount = (filters?.categories.length || 0)
    + (filters?.sizes.length || 0)
    + (filters?.search ? 1 : 0)
    + (priceInput.min !== String(options?.price_range?.min ?? 0) || priceInput.max !== String(options?.price_range?.max ?? 0) ? 1 : 0);

  return (
    <section className="shop-page container py-4 py-lg-5">
      <div className="shop-heading d-flex align-items-end justify-content-between flex-wrap gap-3 mb-4">
        <div>
          <p className="shop-eyebrow mb-1">Curated for your everyday</p>
          <h1 className="h2 fw-bold mb-0">Shop all</h1>
        </div>
        {!loading && <span className="shop-result-count">{products.length} products</span>}
      </div>

      {loading || !options || !filters ? (
        <Loader />
      ) : error && allProducts.length === 0 ? (
        <div className="empty-state text-center py-5">
          <h2 className="h5">Shop is temporarily unavailable</h2>
          <p className="text-muted mb-0">{error}</p>
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

              <FilterSection title="Category" count={filters.categories.length} defaultOpen>
                <div className="shop-category-options">
                  {options.categories.map((category) => (
                    <label key={category.id} className="shop-checkbox-row">
                      <input
                        type="checkbox"
                        checked={filters.categories.includes(String(category.id))}
                        onChange={() => toggle("categories", String(category.id))}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                  {options.categories.length === 0 && <span className="text-muted small">No categories</span>}
                </div>
              </FilterSection>

              <FilterSection title="Size" count={filters.sizes.length}>
                <div className="d-flex flex-wrap gap-2">
                  {options.sizes.map((size) => {
                    const selected = filters.sizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`shop-size-option ${selected ? "is-selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggle("sizes", size)}
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
            {products.length === 0 ? (
              <div className="empty-state text-center py-5">
                <h2 className="h5">No products match those filters</h2>
                <p className="text-muted mb-3">Try a different search or clear your filters.</p>
                <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              <>
                <div className="row mx-0 shop-product-grid">
                  {products.slice(0, visibleCount).map((product) => (
                    <div key={product.id} className="col-6 col-md-4 px-1 px-md-2 mb-3">
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
                {visibleCount < products.length && (
                  <div className="text-center mt-3">
                    <button type="button" className="slot-loadmore-btn" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                      Load more products
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
