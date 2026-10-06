"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FaBars,
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaXTwitter,
  FaPinterestP,
  FaTiktok,
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
import { api, imgUrl, formatTk } from "@/lib/api";
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

/* ------------------------------------------------------------------ */
/* Live search dropdown (GET api/product-search?q=...)                 */
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
      if (!q.trim()) setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get(
          `api/product-search?q=${encodeURIComponent(q.trim())}`
        );
        setResults(Array.isArray(r?.data) ? r.data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
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
    router.push(`/frontEnd/product-page/${id}`);
  };

  return (
    <div className={className} ref={wrapRef} style={{ position: "relative" }}>
      <div className="d-flex">
        <input
          type="search"
          className="form-control"
          placeholder="What do you need?"
          aria-label="Search products"
          autoComplete="off"
          style={{ height: "3rem" }}
          value={q}
          autoFocus={autoFocusInput}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <button type="button" className="site-btn">
          SEARCH
        </button>
      </div>

      {open && (loading || results || q.trim().length >= 3 || (q.trim().length > 0 && q.trim().length < 3)) && (
        <div
          className="bg-white shadow rounded border"
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
              <div
                key={p.id}
                className="d-flex align-items-center gap-2 p-2 border-bottom"
                style={{ cursor: "pointer" }}
                onClick={() => go(p.id)}
              >
                <img
                  src={imgUrl(p.images?.[0]?.image || p.image)}
                  alt=""
                  width={44}
                  height={44}
                  style={{ objectFit: "cover", borderRadius: 4, background: "#f5f5f5" }}
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
                      Sizes:{" "}
                      {p.sizes
                        .slice(0, 6)
                        .map((s) => s.size)
                        .join(", ")}
                    </div>
                  )}
                </div>
                <div className="fw-bold small" style={{ color: "var(--primary-color)" }}>
                  {p.discount || p.price}৳
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category tree (shared by desktop dropdown + mobile drawer)          */
/* ------------------------------------------------------------------ */
function CategoryTree({ categories, onNavigate, isMobile }) {
  const [hover, setHover] = useState(null);
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {categories.map((c) => (
        <li
          key={c.id}
          style={{ position: "relative" }}
          onMouseEnter={() => setHover(c.id)}
          onMouseLeave={() => setHover(null)}
        >
          <Link
            href={`/frontEnd/${c.slug}`}
            onClick={onNavigate}
            style={
              isMobile
                ? {
                  display: "block",
                  padding: "9px 16px",
                  fontSize: 14,
                  color: "#1c1c1c",
                  borderBottom: "1px solid #eee",
                }
                : undefined
            }
          >
            {c.name}
          </Link>
          {c.all_children?.length > 0 && hover === c.id && (
            <ul
              style={
                isMobile
                  ? { listStyle: "none", margin: 0, padding: 0 }
                  : {
                    position: "absolute",
                    top: 0,
                    left: "100%",
                    background: "#fff",
                    border: "1px solid #ebebeb",
                    minWidth: 220,
                    zIndex: 40,
                    padding: "6px 0",
                    margin: 0,
                    listStyle: "none",
                  }
              }
            >
              {c.all_children.map((s) => (
                <li key={s.id} style={{ position: "relative" }}>
                  <Link
                    href={`/frontEnd/${s.slug}`}
                    onClick={onNavigate}
                    style={{
                      display: "block",
                      padding: "8px 14px",
                      fontSize: 14,
                      color: "#1c1c1c",
                    }}
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
export default function SiteHeader() {
  const { company, social, categories } = useSite();
  const { count, total, setOpen, openCart } = useCart();
  const { isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [catOpen, setCatOpen] = useState(false);     // desktop "All Categories" dropdown
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile slide-in drawer
  const [drawerTab, setDrawerTab] = useState("category");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

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

  const handleLogout = async () => {
    setAccountOpen(false);
    await logout();
    router.push("/");
  };

  const waNumber = (social?.whatsapp_number || company.phone || "")
    .replace(/[^0-9]/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber.startsWith("880") ? waNumber : "88" + waNumber}` : "#";

  const socials = [
    social?.facebook ? { href: social.facebook, icon: <FaFacebookF /> } : null,
    social?.twitter ? { href: social.twitter, icon: <FaXTwitter /> } : null,
    social?.instagram ? { href: social.instagram, icon: <FaInstagram /> } : null,
    social?.youtube ? { href: social.youtube, icon: <FaYoutube /> } : null,
    social?.pinterest ? { href: social.pinterest, icon: <FaPinterestP /> } : null,
  ].filter(Boolean);

  const isActive = (href) => (pathname === href ? "activated-nav" : "");

  return (
    <>
      {/* ================= HEADER ================= */}
      <header className="header">
        {/* -------- top bar -------- */}
        <div className="header__top">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-6 col-md-6 d-none d-xl-block">
                <div className="header__top__left">
                  <ul className="mb-0">
                    <li>
                      <FaEnvelope className="me-2" />
                      {company.email ? (
                        <a href={`mailto:${company.email}`}>{company.email}</a>
                      ) : (
                        <span>{company.email}</span>
                      )}
                    </li>
                  </ul>
                </div>
              </div>
              <div className="col-lg-6 col-md-6 d-none d-xl-block">
                <div className="header__top__right d-flex justify-content-end align-items-center">
                  <div className="header__top__right__social me-4">
                    {socials.map((s, i) => (
                      <a key={i} className="me-3" href={s.href} target="_blank" rel="noopener noreferrer">
                        {s.icon}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -------- middle: logo / nav / cart -------- */}
        <div className="container">
          <div className="row align-items-center">
            {/* mobile hamburger */}
            <div className="col-2 d-xl-none">
              <button
                className="border-0 bg-transparent p-0"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                <FaBars size={22} />
              </button>
            </div>

            <div className="col-8 col-xl-3 text-center text-xl-start header__logo">
              <Link href="/">
                {company.logo ? (
                  <img
                    src={imgUrl(company.logo)}
                    alt={company.name || ""}
                    width={200}
                    height={70}
                    style={{ width: 200, height: "auto", objectFit: "contain" }}
                  />
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
                    <Link className={`desktop-nav-link ${isActive("/frontEnd/shop")}`} href="/frontEnd/shop">
                      Shop
                    </Link>
                  </li>
                  <li className="mx-3">
                    <Link
                      className={`desktop-nav-link ${isActive("/frontEnd/about_us")}`}
                      href="/frontEnd/about_us"
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
                            href="/account"
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
                <div
                  className="hero__categories__all"
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => setCatOpen((v) => !v)}
                >
                  <FaBars className="hero_category_icon" />
                  <span>All Categories</span>
                </div>
                {catOpen && (
                  <ul
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
                      <li style={{ listStyle: "none" }}>
                        <a style={{ pointerEvents: "none" }}>Loading categories...</a>
                      </li>
                    )}
                    {categories.map((c) => (
                      <li key={c.id} style={{ listStyle: "none" }}>
                        <Link href={`/frontEnd/${c.slug}`}>{c.name}</Link>
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
            style={{ background: "rgba(0, 0, 0, 0.5)", zIndex: 10000 }}
            onClick={() => setDrawerOpen(false)}
            className="position-fixed top-0 start-0 w-100 h-100 d-xl-none"
          />
          <div
            style={{
              width: "80vw",
              maxWidth: 350,
              boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
              overflowY: "auto",
              zIndex: 10001,
              animation: "slideInLeft 0.3s ease",
            }}
            className="position-fixed top-0 start-0 h-100 bg-white d-xl-none"
          >
            <div
              style={{ top: 10, right: "1.5rem", zIndex: 10, cursor: "pointer", position: "absolute" }}
              onClick={() => setDrawerOpen(false)}
            >
              <FaTimes size={22} style={{ color: "red" }} />
            </div>

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
                  <div
                    key={tab}
                    style={{ width: "50%", fontWeight: 600, cursor: "pointer", position: "relative" }}
                    onClick={() => setDrawerTab(tab)}
                  >
                    <span style={{ textTransform: "capitalize" }}>
                      {tab}
                      {drawerTab === tab && (
                        <span
                          style={{
                            position: "absolute",
                            width: "50%",
                            height: 2,
                            background: "var(--primary-color)",
                            bottom: -6,
                            left: 0,
                          }}
                        />
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "1rem" }}>
                {drawerTab === "category" && (
                  <div>
                    <CategoryTree
                      categories={categories}
                      isMobile
                      onNavigate={() => setDrawerOpen(false)}
                    />
                  </div>
                )}
                {drawerTab === "menu" && (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {[
                      { href: "/", label: "Home" },
                      { href: "/frontEnd/shop", label: "Shop" },
                      { href: "/frontEnd/about_us", label: "About Us" },
                      { href: isAuthenticated ? "/account" : "/login", label: isAuthenticated ? "My Account" : "Sign In" },
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
                    <li>
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "11px 16px",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#25D366",
                        }}
                      >
                        <FaWhatsapp /> WhatsApp
                      </a>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================= MOBILE BOTTOM NAV ================= */}
      <div
        className="d-xl-none position-fixed bottom-0 start-0 w-100 bg-white border-top"
        style={{ zIndex: 9999 }}
      >
        <div className="row g-0 text-center py-1" style={{ margin: 0 }}>
          <div className="col px-1">
            <button
              onClick={() => setDrawerOpen(true)}
              type="button"
              className="border-0 bg-transparent w-100 p-0"
            >
              <div className="d-flex flex-column align-items-center justify-content-center">
                <FaBars size={20} className="text-dark" />
                <small style={{ fontSize: 10, whiteSpace: "nowrap" }} className="text-dark mt-1">
                  Category
                </small>
              </div>
            </button>
          </div>
          <div className="col px-1">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none d-block"
            >
              <div className="d-flex flex-column align-items-center justify-content-center">
                <FaWhatsapp size={22} className="text-success" />
                <small style={{ fontSize: 10, whiteSpace: "nowrap" }} className="text-success mt-1">
                  WhatsApp
                </small>
              </div>
            </a>
          </div>
          <div className="col px-1">
            <button
              type="button"
              onClick={openCart}
              className="border-0 bg-transparent w-100 p-0 position-relative"
            >
              <div className="d-flex flex-column align-items-center justify-content-center">
                <div className="position-relative">
                  <FaShoppingCart size={22} className="text-dark" />
                  {count > 0 && (
                    <span
                      style={{ background: "var(--primary-color)", fontSize: 9 }}
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                    >
                      {count}
                    </span>
                  )}
                </div>
                <small style={{ fontSize: 10, whiteSpace: "nowrap" }} className="text-dark mt-1">
                  Cart
                </small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
