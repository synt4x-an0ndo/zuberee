"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiMenu } from "react-icons/fi";
import { cx } from "@/components/ui";
import { useSite } from "@/context/SiteContext";

function categoryHref(category) {
  return `/${category.slug}`;
}

function hasActiveRoute(category, pathname) {
  if (pathname === categoryHref(category)) return true;
  return category.children?.some((child) => hasActiveRoute(child, pathname)) || false;
}

/** Recursive inline rows used by the desktop category accordion. */
function InlineRows({ items, pathname }) {
  const [hovered, setHovered] = useState(null);
  const [toggled, setToggled] = useState(null);

  return items.map((category) => {
    const hasChildren = category.children.length > 0;
    const href = categoryHref(category);
    const active = pathname === href;
    const activeChild = category.children.some((child) => hasActiveRoute(child, pathname));
    const isOpen = hovered === category.id || toggled === category.id || activeChild;

    return (
      <div
        key={category.id}
        className={cx("category-menu-group", isOpen && "is-open", activeChild && "has-active-child")}
        onMouseEnter={() => setHovered(category.id)}
        onMouseLeave={() => setHovered((current) => (current === category.id ? null : current))}
      >
        <div className="category-menu-row">
          <Link href={href} className={cx("category-menu-item", active && "is-active")} role="menuitem" aria-current={active ? "page" : undefined}>
            <span>{category.name}</span>
          </Link>
          {hasChildren && (
            <button
              type="button"
              className="category-menu-toggle"
              aria-expanded={isOpen}
              aria-label={`Toggle ${category.name} sub-categories`}
              onClick={() => setToggled((current) => (current === category.id ? null : category.id))}
            >
              <FiChevronDown aria-hidden="true" />
            </button>
          )}
        </div>
        {hasChildren && isOpen && (
          <div className="category-menu-sub-inline anim-fade-in">
            <InlineRows items={category.children} pathname={pathname} />
          </div>
        )}
      </div>
    );
  });
}

/**
 * Customer-facing category visibility. The "Archived" bucket exists for
 * order-history placeholder products and must stay in the database/admin,
 * but it must never appear in any client-side category listing.
 */
const HIDDEN_CATEGORY_SLUGS = new Set(["archived"]);

function pruneHiddenCategories(nodes) {
  return (nodes || [])
    .filter((n) => n && !HIDDEN_CATEGORY_SLUGS.has(String(n.slug || "").toLowerCase()))
    .map((n) =>
      n.children && n.children.length ? { ...n, children: pruneHiddenCategories(n.children) } : n
    );
}

/**
 * Store category dropdown. Desktop uses a refined fixed-position panel under
 * the header control; mobile bottom navigation uses an expandable sheet.
 */
export default function CategoryMenu({ label = "All Categories", className = "" }) {
  const { categories } = useSite();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [panelPos, setPanelPos] = useState(null);
  const ref = useRef(null);
  const isBottomSheet = className.includes("category-menu--bottom");

  useEffect(() => {
    setOpen(false);
    setHovered(null);
    setExpanded(null);
  }, [pathname]);

  useEffect(() => {
    if (!open || isBottomSheet) return undefined;
    const update = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPanelPos({ top: rect.bottom, left, width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, isBottomSheet]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const roots = pruneHiddenCategories(categories.tree);
  if (roots.length === 0) return null;

  const closeAll = () => {
    setOpen(false);
    setHovered(null);
    setExpanded(null);
  };

  return (
    <div
      ref={ref}
      className={cx("category-menu", open && "is-open", className)}
      onMouseEnter={!isBottomSheet ? () => setOpen(true) : undefined}
      onMouseLeave={!isBottomSheet ? closeAll : undefined}
    >
      <button
        type="button"
        className="category-menu-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <FiMenu aria-hidden="true" />
        <span>{label}</span>
        <FiChevronDown aria-hidden="true" className="category-menu-caret" />
      </button>

      {open && (
        <div
          className="category-menu-panel anim-scale-in"
          role="menu"
          style={
            !isBottomSheet && panelPos
              ? { position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width, zIndex: 1200 }
              : undefined
          }
        >
          {roots.map((category) => {
            const hasChildren = category.children.length > 0;
            const href = categoryHref(category);
            const active = pathname === href;
            const activeChild = category.children.some((child) => hasActiveRoute(child, pathname));

            if (isBottomSheet) {
              const isExpanded = expanded === category.id || activeChild;
              return (
                <div key={category.id} className={cx("category-menu-group", isExpanded && "is-expanded", activeChild && "has-active-child")}>
                  {hasChildren ? (
                    <button
                      type="button"
                      className={cx("category-menu-item", "is-toggle", active && "is-active")}
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded(isExpanded ? null : category.id)}
                    >
                      <span>{category.name}</span>
                      <FiChevronDown aria-hidden="true" className="category-menu-chevron-mobile" />
                    </button>
                  ) : (
                    <Link href={href} className={cx("category-menu-item", active && "is-active")} role="menuitem" aria-current={active ? "page" : undefined}>
                      <span>{category.name}</span>
                    </Link>
                  )}
                  {hasChildren && (
                    <div className={cx("category-menu-sub", "anim-fade-in", isExpanded && "is-expanded")}>
                      <Link href={href} className={cx(active && "is-active")} aria-current={active ? "page" : undefined}>All {category.name}</Link>
                      {category.children.map((child) => {
                        const childHref = categoryHref(child);
                        const childActive = pathname === childHref;
                        return (
                          <Link key={child.id} href={childHref} className={cx(childActive && "is-active")} aria-current={childActive ? "page" : undefined}>
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isHovered = hovered === category.id;
            const isOpen = isHovered || expanded === category.id || activeChild;
            return (
              <div
                key={category.id}
                className={cx("category-menu-group", isHovered && "is-hovered", isOpen && "is-open", activeChild && "has-active-child")}
                onMouseEnter={() => setHovered(category.id)}
                onMouseLeave={() => setHovered((current) => (current === category.id ? null : current))}
              >
                <div className="category-menu-row">
                  <Link href={href} className={cx("category-menu-item", active && "is-active")} role="menuitem" aria-current={active ? "page" : undefined}>
                    <span>{category.name}</span>
                  </Link>
                  {hasChildren && (
                    <button
                      type="button"
                      className="category-menu-toggle"
                      aria-expanded={isOpen}
                      aria-label={`Toggle ${category.name} sub-categories`}
                      onClick={() => setExpanded((current) => (current === category.id ? null : category.id))}
                    >
                      <FiChevronDown aria-hidden="true" />
                    </button>
                  )}
                </div>
                {hasChildren && isOpen && (
                  <div className="category-menu-sub-inline anim-fade-in">
                    <InlineRows items={category.children} pathname={pathname} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}