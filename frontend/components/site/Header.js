"use client";

import Link from "next/link";
import useExitPresence from "@/lib/useExitPresence";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FiChevronDown,
  FiGrid,
  FiHome,
  FiMenu,
  FiShoppingBag,
  FiShoppingCart,
  FiTag,
  FiTruck,
  FiUser,
  FiX,
} from "react-icons/fi";
import UserAvatar from "@/components/UserAvatar";
import Img from "@/components/Img";
import LiveProductSearch from "@/components/site/LiveProductSearch";
import CategoryMenu from "@/components/site/CategoryMenu";
import { cx } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";

export default function Header() {
  const pathname = usePathname() || "/";
  const { siteName, company, categories, loading, logoSizes } = useSite();
  const { isAuthenticated, user } = useAuth();
  const { count, openDrawer } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [compactNav, setCompactNav] = useState(false);
  const previousScrollY = useRef(0);
  const directionTravel = useRef(0);
  const scrollDirection = useRef(0);
  const compactNavRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPresent = useExitPresence(menuOpen);
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
    if (!menuPresent) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuPresent]);

  const roots = categories.tree;
  const isActive = (href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const drawerAccountActive = pathname === "/user" || pathname.startsWith("/user/profile");
  const drawerOrdersActive = isActive("/user/orders");
  const logo = company.logo;

  return (
    <>
      <header className={cx("site-header", scrolled && "is-scrolled", compactNav && "is-nav-compact")}>
      <div className="container">
        <div className="header-inner">
          <button type="button" className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FiMenu aria-hidden="true" />
          </button>

          <Link href="/" className="brand" aria-label={siteName || "Home"} style={{ marginRight: "auto", marginLeft: 0, flex: "0 0 auto" }}>
            {logo ? (
              <Img src={logo} alt={siteName || "Logo"} width={logoSizes.header.width} height={logoSizes.header.height} style={{ width: logoSizes.header.width, height: logoSizes.header.height, objectFit: "contain" }} priority />
            ) : loading ? (
              <span className="skeleton brand-placeholder" aria-hidden="true" />
            ) : siteName ? (
              <span className="brand-name">{siteName}</span>
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



          <div className="header-actions" style={{ marginLeft: 0, marginRight: 0, flex: "0 0 auto" }}>
            <Link
              href={isAuthenticated ? "/user" : "/login"}
              className="icon-btn"
              aria-label={isAuthenticated ? `Account${user?.name ? `: ${user.name}` : ""}` : "Sign in"}
              title={isAuthenticated ? "My account" : "Sign in"}
            >
              {isAuthenticated ? <UserAvatar image={user?.image} width={26} height={26} /> : <FiUser aria-hidden="true" />}
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
          <LiveProductSearch className="header-search" />
        </div>
      </div>

      </header>
      {menuPresent && (
        <div className={cx("mobile-drawer", !menuOpen && "is-closing")} onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
          <aside className="mobile-drawer-panel" aria-label="Menu">
            <div className="drawer-head">
              {logo ? (
                <Img
                  className="drawer-head-brand"
                  src={logo}
                  alt={siteName || "Logo"}
                  width={logoSizes.header.width}
                  height={logoSizes.header.height}
                  style={{ height: 42, width: "auto", maxWidth: 170, objectFit: "contain", display: "block" }}
                />
              ) : (
                <span className="drawer-head-name">{siteName || "Menu"}</span>
              )}
              <button type="button" className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <FiX aria-hidden="true" />
              </button>
            </div>

            <LiveProductSearch className="drawer-search" placeholder="Search products..." />

            <div className="drawer-section">
              <h2 className="drawer-section-title">
                <FiGrid aria-hidden="true" className="drawer-section-icon" />
                Product Categories
              </h2>
              <nav className="drawer-cards" aria-label="Product categories">
                <Link href="/shop" className="drawer-card">
                  <FiGrid aria-hidden="true" className="drawer-card-icon" />
                  <span className="drawer-card-label">All Products</span>
                </Link>
                {roots.map((category) => {
                  const hasChildren = category.children.length > 0;
                  const categoryHref = `/${category.slug}`;
                  const categoryActive = pathname === categoryHref;
                  const activeChild = category.children.some((child) => pathname === `/${child.slug}`);
                  const expanded = openGroup === category.id || activeChild;
                  const count = category.productCount;
                  return (
                    <div className={cx("drawer-card-group", activeChild && "has-active-child")} key={category.id}>
                      <div className={cx("drawer-card", hasChildren && "has-chevron", categoryActive && "is-active")}>
                        <Link href={categoryHref} className="drawer-card-link" aria-current={categoryActive ? "page" : undefined}>
                          <FiTag aria-hidden="true" className="drawer-card-icon" />
                          <span className="drawer-card-label">{category.name}</span>
                          {Number.isFinite(count) ? <span className="drawer-card-count">{count}</span> : null}
                        </Link>
                        {hasChildren ? (
                          <button
                            type="button"
                            className="drawer-card-chevron"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? "Hide" : "Show"} ${category.name} subcategories`}
                            onClick={() => setOpenGroup(expanded ? null : category.id)}
                          >
                            <FiChevronDown
                              aria-hidden="true"
                              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .25s" }}
                            />
                          </button>
                        ) : null}
                      </div>
                      {hasChildren && expanded ? (
                        <div className="drawer-sub anim-fade-in">
                          <Link href={`/${category.slug}`}>All {category.name}</Link>
                          {category.children.map((child) => {
                            const childHref = `/${child.slug}`;
                            const childActive = pathname === childHref;
                            return (
                              <Link key={child.id} href={childHref} className={cx(childActive && "is-active")} aria-current={childActive ? "page" : undefined}>
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            </div>

            <div className="drawer-section">
              <h2 className="drawer-section-title">Quick Links</h2>
              <nav className="drawer-cards" aria-label="Quick links">
                <Link href="/" className={cx("drawer-card", isActive("/") && "is-active")} aria-current={isActive("/") ? "page" : undefined}>
                  <FiHome aria-hidden="true" className="drawer-card-icon" />
                  <span className="drawer-card-label">Home</span>
                </Link>
                <Link href="/shop" className={cx("drawer-card", isActive("/shop") && "is-active")} aria-current={isActive("/shop") ? "page" : undefined}>
                  <FiShoppingBag aria-hidden="true" className="drawer-card-icon" />
                  <span className="drawer-card-label">Shop</span>
                </Link>
                <Link href="/track-order" className={cx("drawer-card", isActive("/track-order") && "is-active")} aria-current={isActive("/track-order") ? "page" : undefined}>
                  <FiTruck aria-hidden="true" className="drawer-card-icon" />
                  <span className="drawer-card-label">Track Order</span>
                </Link>
                {isAuthenticated ? (
                  <>
                    <Link href="/user" className={cx("drawer-card", drawerAccountActive && "is-active")} aria-current={drawerAccountActive ? "page" : undefined}>
                      <FiUser aria-hidden="true" className="drawer-card-icon" />
                      <span className="drawer-card-label">My account</span>
                    </Link>
                    <Link href="/user/orders" className={cx("drawer-card", drawerOrdersActive && "is-active")} aria-current={drawerOrdersActive ? "page" : undefined}>
                      <FiShoppingBag aria-hidden="true" className="drawer-card-icon" />
                      <span className="drawer-card-label">My orders</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login" className={cx("drawer-card", isActive("/login") && "is-active")} aria-current={isActive("/login") ? "page" : undefined}>
                      <FiUser aria-hidden="true" className="drawer-card-icon" />
                      <span className="drawer-card-label">Sign in</span>
                    </Link>
                    <Link href="/register" className={cx("drawer-card", isActive("/register") && "is-active")} aria-current={isActive("/register") ? "page" : undefined}>
                      <FiUser aria-hidden="true" className="drawer-card-icon" />
                      <span className="drawer-card-label">Create account</span>
                    </Link>
                  </>
                )}
                <Link href="/cart" className={cx("drawer-card", isActive("/cart") && "is-active")} aria-current={isActive("/cart") ? "page" : undefined}>
                  <FiShoppingCart aria-hidden="true" className="drawer-card-icon" />
                  <span className="drawer-card-label">Cart</span>
                  <span className="drawer-card-count">{count}</span>
                </Link>
              </nav>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
