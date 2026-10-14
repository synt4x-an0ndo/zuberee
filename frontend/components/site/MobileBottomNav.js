"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaWhatsapp } from "react-icons/fa";
import { FiGrid, FiHome, FiMessageCircle, FiShoppingBag, FiShoppingCart } from "react-icons/fi";
import { cx } from "@/components/ui";
import CategoryMenu from "@/components/site/CategoryMenu";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";

/** Compact mobile shortcuts, with the same category picker available on the homepage. */
export default function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const { count, openDrawer } = useCart();
  const { categories, social } = useSite();
  const whatsapp = String(social.whatsapp || "").replace(/\D/g, "");
  const categoryActive = categories.flat.some((category) => pathname === `/${category.slug}`);
  const shopActive = pathname === "/shop" || pathname.startsWith("/shop/");
  const cartLabel = count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Open cart";

  return (
    <nav className="mobile-bottom-nav" aria-label="Store shortcuts">
      <Link
        href="/"
        className={cx("mobile-bottom-nav__item", pathname === "/" && "is-active")}
        aria-current={pathname === "/" ? "page" : undefined}
      >
        <FiHome aria-hidden="true" />
        <span>Home</span>
      </Link>

      <Link
        href="/shop"
        className={cx("mobile-bottom-nav__item", shopActive && "is-active")}
        aria-current={shopActive ? "page" : undefined}
      >
        <FiShoppingBag aria-hidden="true" />
        <span>Shop</span>
      </Link>

      {categories.tree.length > 0 ? (
        <CategoryMenu label="Category" className={cx("category-menu--bottom", categoryActive && "is-active")} />
      ) : (
        <span className="mobile-bottom-nav__item is-disabled" aria-disabled="true">
          <FiGrid aria-hidden="true" />
          <span>Category</span>
        </span>
      )}

      {whatsapp ? (
        <a
          href={`https://wa.me/${whatsapp}`}
          className="mobile-bottom-nav__item"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
        >
          <FaWhatsapp aria-hidden="true" />
          <span>WhatsApp</span>
        </a>
      ) : (
        <Link href="/about_us" className="mobile-bottom-nav__item">
          <FiMessageCircle aria-hidden="true" />
          <span>Contact</span>
        </Link>
      )}

      <button type="button" className="mobile-bottom-nav__item cart-shortcut" onClick={openDrawer} aria-label={cartLabel}>
        <FiShoppingCart aria-hidden="true" />
        <span>Cart</span>
        {count > 0 && <span className="mobile-bottom-nav__badge">{count > 99 ? "99+" : count}</span>}
      </button>
    </nav>
  );
}