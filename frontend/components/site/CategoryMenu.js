"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiMenu } from "react-icons/fi";
import { cx } from "@/components/ui";
import { useSite } from "@/context/SiteContext";

/**
 * "All Categories" dropdown button (the category menu pattern used on
 * eyarafashion.com). Lists every root category; categories with children
 * expand to reveal their sub-categories. Closes on outside click, Escape or
 * navigation, and renders nothing when the store has no categories yet.
 */
export default function CategoryMenu({ label = "All Categories", className = "" }) {
  const { categories } = useSite();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const ref = useRef(null);

  // Collapse whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

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
  }, [open]);

  const roots = categories.tree;
  if (roots.length === 0) return null;

  return (
    <div ref={ref} className={cx("category-menu", open && "is-open", className)}>
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
        <div className="category-menu-panel anim-scale-in" role="menu">
          {roots.map((category) => {
            const hasChildren = category.children.length > 0;
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
                    <FiChevronRight aria-hidden="true" className="category-menu-chevron-desktop" />
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
          })}
        </div>
      )}
    </div>
  );
}
