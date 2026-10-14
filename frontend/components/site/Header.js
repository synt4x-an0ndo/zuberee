"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiMenu, FiSearch, FiShoppingBag, FiUser, FiX } from "react-icons/fi";
import Img from "@/components/Img";
import CategoryMenu from "@/components/site/CategoryMenu";
import { cx } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";

function SearchForm({ className, placeholder = "Search products" }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const q = value.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    setValue("");
  };

  return (
    <form className={className} onSubmit={submit} role="search">
      <FiSearch aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        enterKeyHint="search"
      />
    </form>
  );
}

export default function Header() {
  const pathname = usePathname() || "/";
  const { siteName, company, categories, loading } = useSite();
  const { isAuthenticated, user } = useAuth();
  const { count, openDrawer } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [compactNav, setCompactNav] = useState(false);
  const previousScrollY = useRef(0);
  const directionTravel = useRef(0);
  const scrollDirection = useRef(0);
  const compactNavRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);

  useEffect(() => {
    let frame = null;
    let anchorTimer = null;
    const updateCompactNav = (value) => {
      if (compactNavRef.current === value) return;
      compactNavRef.current = value;
      const root = document.documentElement;
      root.classList.toggle("site-nav-compact", value);
      root.classList.add("header-layout-changing");
      if (anchorTimer !== null) window.clearTimeout(anchorTimer);
      anchorTimer = window.setTimeout(() => {
        root.classList.remove("header-layout-changing");
        anchorTimer = null;
      }, 240);
      setCompactNav(value);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const currentY = window.scrollY;
        const delta = currentY - previousScrollY.current;
        setScrolled(currentY > 8);

        if (!window.matchMedia("(min-width: 1025px)").matches) {
          directionTravel.current = 0;
          scrollDirection.current = 0;
          updateCompactNav(false);
        } else if (currentY <= 88) {
          directionTravel.current = 0;
          scrollDirection.current = 0;
          updateCompactNav(false);
        } else if (delta !== 0) {
          const nextDirection = delta > 0 ? 1 : -1;
          if (nextDirection !== scrollDirection.current) {
            directionTravel.current = 0;
            scrollDirection.current = nextDirection;
          }
          directionTravel.current += Math.abs(delta);

          if (nextDirection > 0 && directionTravel.current >= 24) {
            updateCompactNav(true);
            directionTravel.current = 0;
          } else if (nextDirection < 0 && directionTravel.current >= 32) {
            updateCompactNav(false);
            directionTravel.current = 0;
          }
        }

        previousScrollY.current = currentY;
      });
    };

    previousScrollY.current = window.scrollY;
    document.documentElement.classList.toggle("site-nav-compact", compactNavRef.current);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (anchorTimer !== null) window.clearTimeout(anchorTimer);
      document.documentElement.classList.remove("site-nav-compact", "header-layout-changing");
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const roots = categories.tree;
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const logo = company.logo;

  return (
    <>
      <header className={cx("site-header", scrolled && "is-scrolled", compactNav && "is-nav-compact")}>
      <div className="container">
        <div className="header-inner">
          <button type="button" className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FiMenu aria-hidden="true" />
          </button>

          <Link href="/" className="brand" aria-label={siteName || "Home"}>
            {logo ? (
              <Img src={logo} alt={siteName || "Logo"} width={180} height={44} priority />
            ) : siteName ? (
              <span className="brand-name">{siteName}</span>
            ) : loading ? (
              <span className="skeleton brand-placeholder" />
            ) : (
              <span className="brand-name">Shop</span>
            )}
          </Link>

          <nav className="primary-nav" aria-label="Main">
            <Link href="/" className={cx("nav-link", isActive("/") && "is-active")}>
              Home
            </Link>
            <Link href="/shop" className={cx("nav-link", isActive("/shop") && "is-active")}>
              Shop
            </Link>
            <Link href="/about_us" className={cx("nav-link", isActive("/about_us") && "is-active")}>
              About Us
            </Link>
          </nav>



          <div className="header-actions">
            <Link
              href={isAuthenticated ? "/user" : "/login"}
              className="icon-btn"
              aria-label={isAuthenticated ? `Account${user?.name ? `: ${user.name}` : ""}` : "Sign in"}
              title={isAuthenticated ? "My account" : "Sign in"}
            >
              <FiUser aria-hidden="true" />
            </Link>
            <button type="button" className="icon-btn cart-btn" onClick={openDrawer} aria-label={`Cart, ${count} items`}>
              <FiShoppingBag aria-hidden="true" />
              {count > 0 && (
                <span className="count num" key={count}>
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="header-category-row">
          <CategoryMenu label="All Categories" className="header-category-menu" />
          <SearchForm className="header-search" />
        </div>
        <SearchForm className="mobile-search" placeholder="Search products" />
      </div>

      </header>
      {menuOpen && (
        <div className="mobile-drawer" onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
          <aside className="mobile-drawer-panel" aria-label="Menu">
            <div className="drawer-head">
              <span className="brand-name" style={{ fontWeight: 800, color: "var(--brand)" }}>
                {siteName || "Menu"}
              </span>
              <button type="button" className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <FiX aria-hidden="true" />
              </button>
            </div>
            <div className="drawer-list">
              <Link href="/shop">All products</Link>
              {roots.map((category) => {
                const hasChildren = category.children.length > 0;
                const expanded = openGroup === category.id;
                return (
                  <div key={category.id}>
                    {hasChildren ? (
                      <button type="button" onClick={() => setOpenGroup(expanded ? null : category.id)} aria-expanded={expanded}>
                        {category.name}
                        <FiChevronDown
                          aria-hidden="true"
                          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .25s" }}
                        />
                      </button>
                    ) : (
                      <Link href={`/${category.slug}`}>{category.name}</Link>
                    )}
                    {hasChildren && expanded && (
                      <div className="sub anim-fade-in">
                        <Link href={`/${category.slug}`}>All {category.name}</Link>
                        {category.children.map((child) => (
                          <Link key={child.id} href={`/${child.slug}`}>
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="drawer-list" style={{ marginTop: "1.25rem" }}>
              {isAuthenticated ? (
                <>
                  <Link href="/user">My account</Link>
                  <Link href="/user/orders">My orders</Link>
                </>
              ) : (
                <>
                  <Link href="/login">Sign in</Link>
                  <Link href="/register">Create account</Link>
                </>
              )}
              <Link href="/cart">Cart ({count})</Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
