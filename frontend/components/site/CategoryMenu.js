"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiMenu } from "react-icons/fi";
import { cx } from "@/components/ui";
import { useSite } from "@/context/SiteContext";

/**
 * "All Categories" dropdown, replicating the eyarafashion.com pattern:
 * a compact panel the same width as the button opens below it (on hover
 * for desktop pointers, on click for touch/keyboard); every root category
 * is a link, and hovering a category that has children flies its
 * sub-categories out in a card to the right (recursively for deeper
 * levels). The mobile bottom-nav variant keeps a tap-to-expand sheet.
 * Closes on outside click, Escape or navigation, and renders nothing
 * when the store has no categories yet.
 */

function FlyoutRows({ items }) {
  const [hovered, setHovered] = useState(null);
  return items.map((category) => {
    const hasChildren = category.children.length > 0;
    return (
      <div
        key={category.id}
        className="category-menu-flyout-group"
        onMouseEnter={() => setHovered(category.id)}
        onMouseLeave={() => setHovered((current) => (current === category.id ? null : current))}
      >
        <Link href={`/${category.slug}`} className="category-menu-item" role="menuitem">
          <span>{category.name}</span>
          {hasChildren && <FiChevronRight aria-hidden="true" />}
        </Link>
        {hasChildren && hovered === category.id && (
          <div className="category-menu-flyout">
            <FlyoutRows items={category.children} />
          </div>
        )}
      </div>
    );
  });
}

export default function CategoryMenu({ label = "All Categories", className = "" }) {
  const { categories } = useSite();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [panelPos, setPanelPos] = useState(null);
  const ref = useRef(null);

  // The mobile bottom-nav variant is a fixed bottom sheet in CSS. The header
  // variant must also be fixed-positioned (measured from the button): as an
  // absolutely-positioned panel inside the sticky header it painted *under*
  // the hero/page content, so real mouse clicks landed on the page behind
  // it and the menu closed without navigating.
  const isBottomSheet = className.includes("category-menu--bottom");

  // Collapse whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  // Measure (and keep measuring) the header panel's fixed position so the
  // panel hugs the button exactly like Eyara (same width, flush below).
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

  // Close on outside click or Escape.
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
  }, [open ]);

  const roots = categories.tree;
  if (roots.length === 0) return null;

  const closeAll = () => {
    setOpen(false);
    setHovered(null);
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
        onClick={() => setOpen((v) => !v)}
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

            // Mobile sheet: tap a parent to expand its children inline.
            if (isBottomSheet) {
              const isExpanded = expanded === category.id;
              return (
                <div key={category.id} className={cx("category-menu-group", isExpanded && "is-expanded")}>
                  {hasChildren ? (
                    <button
                      type="button"
                      className="category-menu-item is-toggle"
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded(isExpanded ? null : category.id)}
                    >
                      <span>{category.name}</span>
                      <FiChevronDown aria-hidden="true" className="category-menu-chevron-mobile" />
                    </button>
                  ) : (
                    <Link href={`/${category.slug}`} className="category-menu-item" role="menuitem">
                      <span>{category.name}</span>
                    </Link>
                  )}
                  {hasChildren && (
                    <div className={cx("category-menu-sub", "anim-fade-in", isExpanded && "is-expanded")}>
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
            }

            // Desktop header (Eyara): the row itself is the link; children
            // fly out to the right while the row is hovered.
            const isHovered = hovered === category.id;
            return (
              <div
                key={category.id}
                className={cx("category-menu-group", isHovered && "is-hovered")}
                onMouseEnter={() => setHovered(category.id)}
                onMouseLeave={() => setHovered((current) => (current === category.id ? null : current))}
              >
                <Link href={`/${category.slug}`} className="category-menu-item" role="menuitem">
                  <span>{category.name}</span>
                  {hasChildren && <FiChevronRight aria-hidden="true" />}
                </Link>
                {hasChildren && isHovered && (
                  <div className="category-menu-flyout">
                    <FlyoutRows items={category.children} />
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
