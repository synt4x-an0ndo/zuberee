"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FaBars,
  FaPhone as FaPhoneAlt,
  FaCartShopping as FaShoppingCart,
  FaChevronDown,
  FaXmark as FaTimes,
  FaUser,
  FaArrowRightToBracket,
  FaArrowRightFromBracket,
} from "react-icons/fa6";
import { FaWhatsapp } from "react-icons/fa";
import { useSite } from "@/context/SiteContext";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, imgUrl, formatTk, unwrapList } from "@/lib/api";
import notify from "@/components/notify";

const accountMenuItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "10px 18px",
  color: "#68737e",
  fontSize: 16,
  textDecoration: "none",
  cursor: "pointer",
};

function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return digits;
  return digits.startsWith("0") ? `88${digits}` : `880${digits}`;
}

/* ------------------------------------------------------------------ */
/* Live search dropdown (GET api/products?search=...)                  */
/* ------------------------------------------------------------------ */
function SearchBox({ onNavigate, autoFocusInput, className }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 3) {
      setLoading(false);
      setResults(q.trim() ? [] : null);
      return;
    }
    const controller = new AbortController();
    const query = q.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get(
          `api/products?search=${encodeURIComponent(query)}`,
          { auth: false, signal: controller.signal }
        );
        setResults(unwrapList(r, ["products", "results"]));
      } catch (error) {
        if (error?.name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (id) => {
    setOpen(false);
    setQ("");
    setResults(null);
    onNavigate?.();
    router.push(`/product-page/${id}`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = q.trim();
    setOpen(false);
    onNavigate?.();
    router.push(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  return (
    <div className={className} ref={wrapRef} style={{ position: "relative" }}>
      <form className="d-flex search-form" role="search" onSubmit={submitSearch}>
        <input
          type="search"
          className="form-control"
          placeholder="Search products"
          aria-label="Search products"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && (Boolean(results) || loading)}
          aria-controls="product-search-results"
          autoComplete="off"
          value={q}
          autoFocus={autoFocusInput}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <button type="submit" className="site-btn" aria-label="Search">
          Search
        </button>
      </form>

      {open && (loading || results || q.trim().length >= 3 || (q.trim().length > 0 && q.trim().length < 3)) && (
        <div
          id="product-search-results"
          role="listbox"
          aria-label="Product search results"
          className="bg-white shadow rounded border search-results"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 420,
            overflowY: "auto",
            marginTop: 4,
          }}
        >
          {loading && (
            <div className="p-3 small text-muted">Loading…</div>
          )}
          {!loading && q.trim().length > 0 && q.trim().length < 3 && (
            <div className="p-3 small text-muted">Type at least 3 characters</div>
          )}
          {!loading && results && results.length === 0 && q.trim().length >= 3 && (
            <div className="p-3 small text-muted">
              No products found for “{q.trim()}”
            </div>
          )}
          {!loading &&
            results?.map((p) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                aria-label={`View ${p.title || "product"}`}
                key={p.id}
                className="d-flex align-items-center gap-2 p-2 border-bottom w-100 text-start search-result-option"
                onClick={() => go(p.id)}
              >
                <img
                  src={imgUrl(p.images?.[0]?.image || p.image) || undefined}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  style={{ objectFit: "cover", borderRadius: 6, background: "#f5f5f5", flex: "0 0 auto" }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    className="small fw-semibold text-truncate"
                    style={{ maxWidth: 260 }}
                    title={p.title}
                  >
                    {p.title}
                  </div>
                  {Array.isArray(p.sizes) && p.sizes.length > 0 && (
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      Sizes: {p.sizes.slice(0, 6).map((size) => size.size).join(", ")}
                    </div>
                  )}
                </div>
                <div className="fw-bold small" style={{ color: "var(--primary-color)" }}>
                  {formatTk(p.discount ?? p.price)}৳
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category tree (shared by desktop dropdown + mobile drawer)          */
/* ------------------------------------------------------------------ */
function CategoryTree({ categories = [], onNavigate, isMobile = false }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <ul className={`category-tree ${isMobile ? "category-tree--mobile" : ""}`}>
      {categories.map((category) => {
        const children = category.all_children || category.children || [];
        const isExpanded = String(expanded) === String(category.id);
        return (
          <li className="category-tree-item" key={category.id}>
            <div className="category-tree-row">
              <Link href={`/${category.slug || category.id}`} onClick={onNavigate}>
                {category.name}
              </Link>
              {children.length > 0 && (
                <button
                  type="button"
                  className="category-tree-toggle"
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.name}`}
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : category.id)}
                >
                  <FaChevronDown className={isExpanded ? "is-expanded" : ""} aria-hidden="true" />
                </button>
              )}
            </div>
            {children.length > 0 && isExpanded && (
              <CategoryTree categories={children} onNavigate={onNavigate} isMobile={isMobile} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
export default function SiteHeader() {
  const { company, footer, social, categories, loading: siteLoading } = useSite();
  const { count, total, openCart } = useCart();
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [catOpen, setCatOpen] = useState(false);     // desktop "All Categories" dropdown
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile slide-in drawer
  const [drawerTab, setDrawerTab] = useState("category");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const drawerCloseRef = useRef(null);

  useEffect(() => {
    setCatOpen(false);
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      document.body.style.removeProperty("overflow");
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setAccountOpen(false);
    await logout();
    router.push("/");
  };

  const waNumber = normalizeWhatsapp(social?.whatsapp_number || company.phone);
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null;
  const logoSrc = imgUrl(footer?.logo_path || footer?.company_logo || company.logo);

  const isActive = (href) => (pathname === href ? "activated-nav" : "");

  return (
    <>
      {/* ================= HEADER ================= */}
      <header className="header">
        {/* -------- middle: logo / nav / cart -------- */}
        <div className="container">
          <div className="row align-items-center">
            {/* mobile hamburger */}
            <div className="col-2 d-xl-none">
              <button
                type="button"
                className="border-0 bg-transparent p-0"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                aria-controls="mobile-navigation-drawer"
                onClick={() => setDrawerOpen(true)}
              >
                <FaBars size={22} />
              </button>
            </div>

            <div className="col-8 col-xl-3 text-center text-xl-start header__logo">
              <Link href="/" aria-label={company.name ? `${company.name} home` : "Home"}>
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={company.name || "Site logo"}
                    width={200}
                    height={70}
                    className="site-logo"
                  />
                ) : company.name ? (
                  <span className="site-brand-text">{company.name}</span>
                ) : null}
              </Link>
            </div>

            <div className="col-xl-6 d-none d-xl-block">
              <nav className="header__menu">
                <ul className="d-flex justify-content-center align-items-center mb-0 nav-list">
                  <li className="mx-3">
                    <Link className={`desktop-nav-link ${isActive("/")}`} href="/">
                      Home
                    </Link>
                  </li>
                  <li className="mx-3">
                    <Link className={`desktop-nav-link ${isActive("/shop")}`} href="/shop">
                      Shop
                    </Link>
                  </li>
                  <li className="mx-3">
                    <Link
                      className={`desktop-nav-link ${isActive("/about_us")}`}
                      href="/about_us"
                    >
                      About Us
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>

            <div className="col-2 col-xl-3 d-flex align-items-center justify-content-end">
              <div className="d-flex align-items-center justify-content-end">
                <div ref={accountRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 me-3 text-dark"
                    aria-label="Open account menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen((open) => !open)}
                  >
                    <FaUser size={18} />
                  </button>
                  {accountOpen && (
                    <div
                      role="menu"
                      aria-label="Account menu"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 14px)",
                        right: 8,
                        width: 185,
                        padding: "8px 0",
                        background: "#fff",
                        border: "1px solid #d9ddd9",
                        borderRadius: 0,
                        boxShadow: "0 10px 24px rgba(24, 37, 30, .12)",
                        zIndex: 100,
                      }}
                    >
                      {!isAuthenticated ? (
                        <>
                          <Link
                            href="/login"
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            style={accountMenuItemStyle}
                          >
                            <FaArrowRightToBracket />
                            <span>Log In</span>
                          </Link>
                          <Link
                            href="/register"
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            style={accountMenuItemStyle}
                          >
                            <FaUser />
                            <span>Register</span>
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/user"
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            style={accountMenuItemStyle}
                          >
                            <FaUser />
                            <span>Dashboard</span>
                          </Link>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            style={{ ...accountMenuItemStyle, width: "100%", border: 0, background: "transparent", textAlign: "left" }}
                          >
                            <FaArrowRightFromBracket />
                            <span>Log Out</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="cart-icon-btn border-0 bg-transparent position-relative me-3"
                  aria-label="Open cart"
                  onClick={openCart}
                >
                  <FaShoppingCart size={20} />
                  {count > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                      style={{ background: "var(--primary-color)", fontSize: 9 }}
                    >
                      {count}
                    </span>
                  )}
                </button>
                <div className="header__cart__price d-none d-lg-block">
                  <span className="fw-bold">Cart Total: {formatTk(total)} Tk</span>
                </div>
              </div>
            </div>
          </div>

          {/* -------- categories + search row -------- */}
          <div className="row d-none d-xl-flex position-relative align-items-center">
            <div className="col-lg-3 mb-lg-4" style={{ position: "relative" }}>
              <div
                className="hero__categories"
                style={{ position: "relative" }}
                onMouseEnter={() => setCatOpen(true)}
                onMouseLeave={() => setCatOpen(false)}
              >
                <button
                  type="button"
                  className="hero__categories__all"
                  aria-expanded={catOpen}
                  aria-controls="desktop-category-menu"
                  onClick={() => setCatOpen((value) => !value)}
                >
                  <FaBars className="hero_category_icon" aria-hidden="true" />
                  <span>All categories</span>
                  <FaChevronDown className={`category-dropdown-icon ${catOpen ? "is-open" : ""}`} aria-hidden="true" />
                </button>
                {catOpen && (
                  <ul
                    id="desktop-category-menu"
                    role="menu"
                    style={{
                      display: "block",
                      position: "absolute",
                      left: 0,
                      top: 46,
                      width: "100%",
                      zIndex: 30,
                      background: "#fff",
                      border: "1px solid #ebebeb",
                      padding: "10px 0 12px",
                      maxHeight: 480,
                      overflowY: "auto",
                    }}
                  >
                    {categories.length === 0 && (
                      <li className="category-menu-empty">
                        {siteLoading ? "Loading categories…" : "No categories available yet."}
                      </li>
                    )}
                    {categories.map((category) => (
                      <li key={category.id} style={{ listStyle: "none" }}>
                        <Link href={`/${category.slug || category.id}`}>{category.name}</Link>
                        {category.all_children?.length > 0 && (
                          <ul className="desktop-category-submenu">
                            {category.all_children.map((child) => (
                              <li key={child.id}>
                                <Link href={`/${child.slug || child.id}`}>{child.name}</Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="col-lg-9">
              <div className="hero__search">
                <div className="hero__search__form">
                  <SearchBox className="w-100" />
                </div>
                <div className="hero__search__phone">
                  <div className="hero__search__phone__icon">
                    <FaPhoneAlt />
                  </div>
                  <div className="hero__search__phone__text">
                    {company.phone ? <h5>{company.phone}</h5> : null}
                    {company.phone ? <span>support 24/7 time</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MOBILE SEARCH ================= */}
      <div className="container d-xl-none mt-2 mb-2">
        <SearchBox className="w-100" />
      </div>

      {/* ================= MOBILE SLIDE-IN DRAWER ================= */}
      {drawerOpen && (
        <>
          <div
            aria-hidden="true"
            style={{ background: "rgba(0, 0, 0, 0.5)", zIndex: 10000 }}
            onClick={() => setDrawerOpen(false)}
            className="position-fixed top-0 start-0 w-100 h-100 d-xl-none"
          />
          <div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Store navigation"
            style={{
              width: "min(84vw, 360px)",
              boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
              overflowY: "auto",
              zIndex: 10001,
              animation: "slideInLeft 0.3s ease",
            }}
            className="position-fixed top-0 start-0 h-100 bg-white d-xl-none mobile-navigation-drawer"
          >
            <button
              ref={drawerCloseRef}
              type="button"
              className="mobile-drawer-close"
              aria-label="Close navigation menu"
              onClick={() => setDrawerOpen(false)}
            >
              <FaTimes size={20} />
            </button>

            <div style={{ paddingTop: "4rem" }}>
              <div
                style={{
                  width: "100%",
                  height: 50,
                  background: "rgb(248, 248, 248)",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "1.5rem",
                }}
              >
                {["category", "menu"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`mobile-navigation-tab ${drawerTab === tab ? "is-active" : ""}`}
                    aria-pressed={drawerTab === tab}
                    onClick={() => setDrawerTab(tab)}
                  >
                    {tab === "category" ? "Categories" : "Menu"}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: "1rem" }}>
                {drawerTab === "category" && (
                  <div>
                    {categories.length > 0 ? (
                      <CategoryTree
                        categories={categories}
                        isMobile
                        onNavigate={() => setDrawerOpen(false)}
                      />
                    ) : (
                      <p className="mobile-navigation-empty">Categories will appear here when the store is connected.</p>
                    )}
                  </div>
                )}
                {drawerTab === "menu" && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {[
                      { href: "/", label: "Home" },
                      { href: "/shop", label: "Shop" },
                      { href: "/about_us", label: "About Us" },
                      { href: isAuthenticated ? "/user" : "/login", label: isAuthenticated ? "My Account" : "Sign In" },
                    ].map((m) => (
                      <li key={m.href}>
                        <Link
                          href={m.href}
                          onClick={() => setDrawerOpen(false)}
                          style={{
                            display: "block",
                            padding: "11px 16px",
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#1c1c1c",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {m.label}
                        </Link>
                      </li>
                    ))}
                    {waHref && (
                      <li>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mobile-navigation-contact"
                        >
                          <FaWhatsapp /> WhatsApp
                        </a>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </>
  );
}
