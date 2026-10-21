"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { FiSearch } from "react-icons/fi";
import Img from "@/components/Img";
import ViewportPortal from "@/components/ViewportPortal";
import { api, formatMoney, listOf } from "@/lib/api";
import { discountPercent, normalizeProduct } from "@/lib/format";
import styles from "./LiveProductSearch.module.css";

// Short-lived session-memory cache only; details/cart remain authoritative.
const cache = new Map();
const CACHE_MS = 15000;
const MAX_QUERIES = 20;
const LIMIT = 6;
const availability = { "in-stock": "In stock", "pre-order": "Pre-order", "sold-out": "Sold out" };

function Highlight({ text, query }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

function Thumbnail({ product }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.thumbnail} aria-hidden="true">
    {product.image && !failed ? <Img src={product.image} alt="" width={40} height={40} onError={() => setFailed(true)} /> : <span className={styles.imageFallback}>No image</span>}
  </span>;
}

export default function LiveProductSearch({ className = "", placeholder = "Search products" }) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const previousPathname = useRef(pathname);
  const input = useRef(null);
  const form = useRef(null);
  const popup = useRef(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [composing, setComposing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [position, setPosition] = useState(null);
  const [result, setResult] = useState({ query: "", status: "idle", items: [] });
  const query = value.trim();
  const key = query.toLowerCase();
  const expanded = open && Boolean(query);
  const ready = result.query === key && result.status === "ready";
  const failed = result.query === key && result.status === "error";
  const items = ready ? result.items : [];
  const listId = `${id}-products`;

  useEffect(() => {
    // Initial hydration must not erase a query typed before effects settle.
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    setOpen(false);
    setValue("");
    setActive(-1);
  }, [pathname]);

  useEffect(() => {
    if (!expanded || composing) return;
    let current = true;
    const controller = new AbortController();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setResult({ query: key, status: "ready", items: cached.items });
      return;
    }
    setResult({ query: key, status: "loading", items: [] });
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get("api/product-search", { auth: false, params: { q: query, limit: LIMIT }, signal: controller.signal });
        if (!current || controller.signal.aborted) return;
        if (response?.success === false) throw new Error("Search unavailable");
        const products = listOf(response).map(normalizeProduct).filter((product) => product?.id).slice(0, LIMIT);
        cache.delete(key);
        cache.set(key, { at: Date.now(), items: products });
        if (cache.size > MAX_QUERIES) cache.delete(cache.keys().next().value);
        setResult({ query: key, status: "ready", items: products });
      } catch (error) {
        if (current && !controller.signal.aborted && error?.name !== "AbortError") setResult({ query: key, status: "error", items: [] });
      }
    }, 250);
    return () => { current = false; window.clearTimeout(timer); controller.abort(); };
  }, [query, key, expanded, composing, retry]);

  useEffect(() => {
    if (!expanded) return;
    function place() {
      const rect = form.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0;
      const top = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      if (!rect.width || rect.bottom < top || rect.top > top + height) { setOpen(false); return; }
      let bottom = top + height - 8;
      const nav = document.querySelector(".mobile-bottom-nav")?.getBoundingClientRect();
      if (nav?.width && nav.height && nav.top > rect.bottom) bottom = Math.min(bottom, nav.top - 8);
      const popupWidth = Math.min(rect.width, width - 16);
      setPosition({ left: Math.max(left + 8, Math.min(rect.left, left + width - popupWidth - 8)), top: rect.bottom + 6, width: popupWidth, maxHeight: Math.max(0, Math.min(480, bottom - rect.bottom - 6)) });
    }
    function outside(event) {
      if (!form.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false);
    }
    function scroll(event) { if (!popup.current?.contains(event.target)) place(); }
    place();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (form.current) observer?.observe(form.current);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      observer?.disconnect();
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const item = popup.current?.querySelector(`[data-search-index="${active}"]`);
    const panel = popup.current;
    if (!item || !panel) return;
    if (item.offsetTop < panel.scrollTop) panel.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = item.offsetTop + item.offsetHeight - panel.clientHeight;
  }, [active, expanded]);

  function closeAndClear() { setOpen(false); setValue(""); setActive(-1); }
  function submit(event) {
    event.preventDefault();
    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
    closeAndClear();
  }
  function keyDown(event) {
    if (event.nativeEvent.isComposing || composing) return;
    if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
    else if (event.key === "Tab") { setOpen(false); setActive(-1); }
    else if (["ArrowDown", "ArrowUp"].includes(event.key) && query) {
      event.preventDefault();
      setOpen(true);
      if (items.length) setActive((index) => event.key === "ArrowDown" ? (index + 1) % items.length : index <= 0 ? items.length - 1 : index - 1);
    } else if (event.key === "Enter" && expanded && items[active]) {
      event.preventDefault();
      router.push(`/product-page/${encodeURIComponent(items[active].id)}`);
      closeAndClear();
    }
  }

  return <>
    <form ref={form} className={`${className} ${styles.root}`} onSubmit={submit} role="search"
      onBlur={(event) => { if (event.relatedTarget && !form.current?.contains(event.relatedTarget) && !popup.current?.contains(event.relatedTarget)) setOpen(false); }}>
      <FiSearch aria-hidden="true" />
      <input ref={input} type="search" role="combobox" value={value} placeholder={placeholder}
        aria-label="Search products" aria-autocomplete="list" aria-haspopup="listbox"
        aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && items[active] ? `${listId}-${active}` : undefined}
        autoComplete="off" enterKeyHint="search" onKeyDown={keyDown}
        onChange={(event) => { setValue(event.target.value); setActive(-1); setOpen(Boolean(event.target.value.trim())); }}
        onFocus={() => { setActive(-1); if (query) { setOpen(true); if (failed) setRetry((count) => count + 1); } }}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} />
      {value && <button type="button" className={styles.clear} aria-label="Clear product search" onMouseDown={(event) => event.preventDefault()}
        onClick={() => { closeAndClear(); input.current?.focus(); }}>×</button>}
    </form>
    <ViewportPortal>
      {expanded && position && <div ref={popup} className={styles.popup} style={position} data-live-product-search="true">
        <div className={styles.heading}>Products</div>
        <div className={ready && items.length ? styles.srOnly : styles.message} role="status" aria-live="polite">
          {!ready && !failed ? <span className={styles.loading}><span className={styles.spinner} aria-hidden="true" />Searching products…</span>
            : failed ? <span>Search is unavailable. Edit your search or refocus the field to try again.</span>
            : items.length === 0 ? <>No products found for “{query}”.</> : <span className={styles.srOnly}>{items.length} matching products. Use the arrow keys to select and Enter to open a product.</span>}
        </div>
        <ul id={listId} role="listbox" aria-label="Matching products" className={styles.list} aria-busy={!ready && !failed}>
          {items.map((product, index) => <li key={product.id} role="presentation">
            <Link href={`/product-page/${encodeURIComponent(product.id)}`} id={`${listId}-${index}`} role="option"
              aria-selected={active === index} tabIndex={-1} className={styles.item}
              data-search-product={product.id} data-search-index={index}
              onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={closeAndClear}>
            <Thumbnail key={product.image} product={product} />
            <span className={styles.sku}>SKU: {product.sku ? <Highlight text={product.sku} query={query} /> : "—"}</span>
            <span className={styles.title}><Highlight text={product.title} query={query} /></span>
            <span className={styles.meta}>
              <span className={styles.prices}><strong>{formatMoney(product.salePrice)}</strong>{product.hasSale && <><del>{formatMoney(product.price)}</del><span className={styles.discount}>{discountPercent(product.price, product.salePrice)}% off</span></>}</span>
              <span className={styles.stock} data-availability={product.availability}>{availability[product.availability] || "View availability"}</span>
            </span>
            </Link>
          </li>)}
        </ul>
        <div className={styles.all}>Use arrow keys to select a product, then Enter to open. Enter without a selection shows all results.</div>
      </div>}
    </ViewportPortal>
  </>;
}
