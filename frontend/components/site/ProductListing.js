"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp, FiFilter, FiSearch, FiX } from "react-icons/fi";
import ProductCard from "@/components/ProductCard";
import ViewportPortal from "@/components/ViewportPortal";
import { Button, cx, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useSite } from "@/context/SiteContext";
import { api, listOf } from "@/lib/api";
import { normalizeProduct } from "@/lib/format";

const PER_PAGE = 12;
const SIZE_PREVIEW_COUNT = 12;
const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "in-stock", label: "In stock" },
  { value: "pre-order", label: "Pre-order" },
];

/** Filterable catalogue used by /shop and category collection routes. */
export default function ProductListing({ fixedCategory = null, heading, eyebrow, subtitle, showCategoryFilter = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { categories } = useSite();

  const q = params.get("q") || "";
  const category = fixedCategory || params.get("category") || "";
  const sizeFilter = params.get("size") || "";
  const status = params.get("status") || "";
  const min = params.get("min") || "";
  const max = params.get("max") || "";
  const page = Math.max(1, Number(params.get("page") || 1) || 1);

  const [searchDraft, setSearchDraft] = useState(q);
  const [minDraft, setMinDraft] = useState(min);
  const [maxDraft, setMaxDraft] = useState(max);
  const [availableSizes, setAvailableSizes] = useState([]);
  const [sizesExpanded, setSizesExpanded] = useState(false);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [suggest, setSuggest] = useState({ loading: false, items: [], error: "" });
  const filterCloseRef = useRef(null);
  const requestRef = useRef(0);
  const lastLoadedRef = useRef({ key: "", page: 0 });

  useEffect(() => setSearchDraft(q), [q]);
  useEffect(() => setMinDraft(min), [min]);
  useEffect(() => setMaxDraft(max), [max]);

  useEffect(() => {
    let alive = true;
    api
      .get("api/sizes", { auth: false })
      .then((response) => {
        if (!alive) return;
        const values = listOf(response)
          .map((item) => String(item?.size ?? item?.value ?? "").trim())
          .filter(Boolean);
        setAvailableSizes([...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
      })
      .catch(() => alive && setAvailableSizes([]));
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(
    (changes) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      if (!("page" in changes)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  useEffect(() => {
    if (searchDraft.trim() === q) return undefined;
    const timer = setTimeout(() => update({ q: searchDraft.trim() }), 380);
    return () => clearTimeout(timer);
  }, [searchDraft, q, update]);

  /**
   * Instant suggestions while typing, from GET /api/product-search (public, server-limited, title/sku/
   * description match). The grid itself keeps using api/product-pagination, so this never duplicates
   * the filtered query: it is skipped until two characters are typed, debounced, and dropped as soon
   * as the suggestion matches the query already applied to the grid.
   */
  useEffect(() => {
    const term = searchDraft.trim();
    if (term.length < 2 || term === q) {
      setSuggest((current) => (current.items.length || current.loading || current.error ? { loading: false, items: [], error: "" } : current));
      return undefined;
    }
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSuggest((current) => ({ ...current, loading: true, error: "" }));
      api
        .get("api/product-search", { auth: false, params: { q: term, limit: 5 }, signal: controller.signal })
        .then((response) => {
          if (!alive) return;
          const items = listOf(response)
            .map((item) => ({ id: item?.id, title: item?.title || item?.name || "", price: item?.price }))
            .filter((item) => item.id)
            .slice(0, 5);
          setSuggest({ loading: false, items, error: "" });
        })
        .catch((err) => alive && setSuggest({ loading: false, items: [], error: err?.message || "Search unavailable." }));
    }, 300);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchDraft, q]);

  const showSuggestions = searchDraft.trim().length >= 2 && searchDraft.trim() !== q;

  const discoveredSizes = useMemo(
    () => products.flatMap((product) => product.sizes.map((item) => item.label)).filter(Boolean),
    [products]
  );
  const sizeOptions = useMemo(
    () => [...new Set([...availableSizes, ...discoveredSizes])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    [availableSizes, discoveredSizes]
  );
  const visibleSizeOptions = useMemo(() => {
    if (sizesExpanded || sizeOptions.length <= SIZE_PREVIEW_COUNT) return sizeOptions;
    const preview = sizeOptions.slice(0, SIZE_PREVIEW_COUNT);
    return sizeFilter && !preview.includes(sizeFilter) ? [...preview, sizeFilter] : preview;
  }, [sizeOptions, sizeFilter, sizesExpanded]);

  useEffect(() => {
    const id = ++requestRef.current;
    const filterKey = JSON.stringify([q, category, sizeFilter, status, min, max]);
    const previous = lastLoadedRef.current;
    const appendResults = previous.key === filterKey && page > previous.page;

    setLoading(true);
    setError("");
    if (!appendResults && previous.key !== filterKey) setProducts([]);

    const run = async () => {
      try {
        const response = await api.get("api/product-pagination", {
          auth: false,
          params: {
            search: q,
            category,
            size: sizeFilter,
            status,
            min_price: min,
            max_price: max,
            page,
            per_page: PER_PAGE,
          },
        });
        if (id !== requestRef.current) return;
        const incoming = listOf(response).map(normalizeProduct).filter(Boolean);
        setProducts((current) => {
          if (!appendResults) return incoming;
          const existing = new Set(current.map((product) => String(product.id)));
          return [...current, ...incoming.filter((product) => !existing.has(String(product.id)))];
        });
        lastLoadedRef.current = { key: filterKey, page };
        const resultMeta = response?.meta || {};
        setMeta({ total: resultMeta.total ?? 0, total_pages: resultMeta.total_pages ?? 1 });
      } catch (err) {
        if (id !== requestRef.current) return;
        setError(err.message);
        if (!appendResults) setProducts([]);
      } finally {
        if (id === requestRef.current) setLoading(false);
      }
    };
    run();
  }, [q, category, sizeFilter, status, min, max, page, reloadKey]);

  const roots = categories.tree;
  const activeCategory = categories.bySlug.get(category);
  const hasFilters = Boolean(q || (!fixedCategory && category) || sizeFilter || status || min || max);

  const clearFilters = () => {
    setSearchDraft("");
    setMinDraft("");
    setMaxDraft("");
    update({ q: "", category: fixedCategory ? category : "", size: "", status: "", min: "", max: "" });
    setFiltersOpen(false);
  };

  const applyPrice = (event) => {
    event.preventDefault();
    update({ min: minDraft, max: maxDraft });
    setFiltersOpen(false);
  };

  // The mobile filter is a modal drawer: keep scrolling inside it and return
  // keyboard focus to the opener when it closes, just like the other dialogs.
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    filterCloseRef.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = filterCloseRef.current?.closest('[role="dialog"]');
      const controls = Array.from(dialog?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || [])
        .filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [filtersOpen]);

  const renderFilters = (inDrawer = false) => (
    <aside className={cx("filters", inDrawer && "in-drawer")} aria-label="Product filters">
      <div className="filter-panel-head">
        <h2>Filters</h2>
        {inDrawer && (
          <button type="button" className="icon-btn" ref={filterCloseRef} onClick={() => setFiltersOpen(false)} aria-label="Close filters">
            <FiX aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="filter-group filter-search-group">
        <h4>Search</h4>
        <form
          className="filter-search-field"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: searchDraft.trim() });
          }}
        >
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Search products"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            aria-label="Search products"
          />
        </form>
        {showSuggestions && (
          <div className="card" style={{ marginTop: 8, padding: "0.5rem 0.75rem" }} role="status" aria-live="polite">
            {suggest.loading && <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Looking for matches…</p>}
            {!suggest.loading && suggest.error && <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{suggest.error}</p>}
            {!suggest.loading && !suggest.error && suggest.items.length === 0 && (
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>No products match “{searchDraft.trim()}”.</p>
            )}
            {!suggest.loading && !suggest.error && suggest.items.length > 0 && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                {suggest.items.map((item) => (
                  <li key={item.id}>
                    <Link href={`/product-page/${item.id}`} className="muted" style={{ display: "block", padding: "4px 0", fontSize: "0.9rem" }}>
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showCategoryFilter && !fixedCategory && roots.length > 0 && (
        <div className="filter-group">
          <h4>Category</h4>
          <div className="filter-list">
            <button type="button" className={cx(!category && "is-active")} onClick={() => update({ category: "" })} aria-pressed={!category}>
              All categories
            </button>
            {categories.flat.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(item.depth > 0 && "sub", category === item.slug && "is-active")}
                onClick={() => update({ category: item.slug })}
                aria-pressed={category === item.slug}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizeOptions.length > 0 && (
        <div className="filter-group filter-size-group">
          <div className="filter-size-head">
            <h4>Size</h4>
            {sizeFilter && (
              <button type="button" className="filter-size-clear" onClick={() => update({ size: "" })}>
                Clear
              </button>
            )}
          </div>
          {sizeFilter && (
            <p className="filter-size-selected">
              Selected: <strong>{sizeFilter}</strong>
            </p>
          )}
          <div className="filter-size-list" role="group" aria-label="Filter by size">
            {visibleSizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                className={cx(sizeFilter === size && "is-active")}
                onClick={() => update({ size: sizeFilter === size ? "" : size })}
                aria-pressed={sizeFilter === size}
                title={size}
              >
                {size}
              </button>
            ))}
          </div>
          {sizeOptions.length > SIZE_PREVIEW_COUNT && (
            <button
              type="button"
              className="filter-size-toggle"
              onClick={() => setSizesExpanded((current) => !current)}
              aria-expanded={sizesExpanded}
            >
              {sizesExpanded ? (
                <>
                  Show fewer sizes <FiChevronUp aria-hidden="true" />
                </>
              ) : (
                <>
                  Show all {sizeOptions.length} sizes <FiChevronDown aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      <div className="filter-group">
        <h4>Price (৳)</h4>
        <form className="price-range" onSubmit={applyPrice}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Min"
            value={minDraft}
            onChange={(event) => setMinDraft(event.target.value.replace(/\D/g, ""))}
            aria-label="Minimum price"
          />
          <span className="muted">–</span>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Max"
            value={maxDraft}
            onChange={(event) => setMaxDraft(event.target.value.replace(/\D/g, ""))}
            aria-label="Maximum price"
          />
          <Button type="submit" variant="outline" size="sm" style={{ gridColumn: "1 / -1" }}>
            Apply
          </Button>
        </form>
      </div>

      <div className="filter-group">
        <h4>Availability</h4>
        <div className="filter-list">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              className={cx(status === option.value && "is-active")}
              onClick={() => update({ status: option.value })}
              aria-pressed={status === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear all filters
        </Button>
      )}
    </aside>
  );

  const shownCount = Math.min(products.length, meta.total);

  return (
    <div className="container section shop-listing" style={{ paddingTop: "1.5rem" }}>
      {(activeCategory || heading) && (
        <nav className="crumbs anim-fade-in" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          {fixedCategory && activeCategory?.parentName ? (
            <>
              <span>{activeCategory.parentName}</span>
              <span>/</span>
            </>
          ) : null}
          <span>{heading || "Shop"}</span>
        </nav>
      )}

      <div className="listing-top">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{heading || "Shop"}</h1>
          {subtitle && <p className="muted" style={{ marginTop: "0.3rem" }}>{subtitle}</p>}
        </div>
        <div className="listing-top-tools">
          <span className="listing-total num" aria-live="polite">
            {loading && meta.total === 0 ? "Loading products…" : `${meta.total} ${meta.total === 1 ? "product" : "products"}`}
          </span>
          <Button variant="outline" className="mobile-filter-btn" icon={FiFilter} onClick={() => setFiltersOpen(true)}>
            Filters
          </Button>
        </div>
      </div>

      {fixedCategory && activeCategory?.children?.length > 0 && (
        <div className="chip-row" style={{ marginBottom: "1.25rem" }}>
          {activeCategory.children.map((child) => (
            <Link key={child.id} href={`/${child.slug}`} className="chip">
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div className="listing">
        {renderFilters(false)}

        <section className="listing-products" aria-labelledby="all-products-heading">
          <div className="listing-results-head">
            <h2 id="all-products-heading">All Products</h2>
            <span className="muted num" aria-live="polite">
              {loading && products.length === 0 ? "Loading products…" : `Showing ${shownCount} of ${meta.total}`}
            </span>
          </div>
          {status !== "" && <span className="badge badge-brand listing-status-badge">{STATUS_FILTERS.find((item) => item.value === status)?.label}</span>}

          {error ? (
            <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />
          ) : loading && products.length === 0 ? (
            <div className="product-grid shop-products-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="card product-skeleton-card" style={{ padding: 0, overflow: "hidden" }}>
                  <Skeleton style={{ aspectRatio: "4 / 5", width: "100%", borderRadius: 0 }} />
                  <div style={{ padding: "0.9rem" }}>
                    <Skeleton style={{ height: 14, width: "80%" }} />
                    <Skeleton style={{ height: 14, width: "40%", marginTop: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No products match these filters" : "No products yet"}
              text={hasFilters ? "Try a different search or clear the filters." : "New products will appear here once they are published."}
              action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : null}
            />
          ) : (
            <>
              <div className="product-grid shop-products-grid stagger" style={{ opacity: loading ? 0.65 : 1, transition: "opacity .2s" }}>
                {products.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
              {page < meta.total_pages && (
                <div className="load-more-wrap">
                  <Button variant="outline" onClick={() => update({ page: page + 1 })} disabled={loading}>
                    {loading ? "Loading…" : "Load More"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <ViewportPortal>
      {filtersOpen && (
        <div className="overlay filter-overlay" onMouseDown={(event) => event.target === event.currentTarget && setFiltersOpen(false)}>
          <div className="mobile-drawer-panel" role="dialog" aria-modal="true" aria-label="Product filters" style={{ width: "min(360px, 90vw)", height: "100%", overflowY: "auto", padding: "1rem" }}>
            {renderFilters(true)}
          </div>
        </div>
      )}
      </ViewportPortal>
    </div>
  );
}
