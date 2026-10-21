"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiHome, FiMapPin, FiMessageCircle, FiShoppingBag, FiShoppingCart } from "react-icons/fi";
import { cx } from "@/components/ui";
import Img from "@/components/Img";
import ContactSupportModal from "@/components/site/ContactSupportModal";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";

/**
 * Compact mobile shortcuts: Home / Shop / Zuberee / Cart / Track.
 * The centre Zuberee item is highlighted and toggles the Contact Support popup.
 */
export default function MobileBottomNav() {
  const pathname = usePathname() || "/";
  const { count, openDrawer } = useCart();
  const { company } = useSite();
  const [supportOpen, setSupportOpen] = useState(false);
  const shopActive = pathname === "/shop" || pathname.startsWith("/shop/");
  const trackActive = pathname === "/track-order";
  const cartLabel = count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Open cart";

  // The nav is not covered by the popup backdrop, so dismiss when the route changes.
  useEffect(() => {
    setSupportOpen(false);
  }, [pathname]);

  // Match the existing bottom-nav breakpoint and dismiss on desktop resize.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => { if (!media.matches) setSupportOpen(false); };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Any other nav item (Home / Shop / Cart / Track) also dismisses the popup.
  const dismissOnNav = (event) => {
    if (!event.target.closest || !event.target.closest("[data-cs-trigger]")) {
      setSupportOpen(false);
    }
  };

  return (
    <>
      <nav
        className="mobile-bottom-nav"
        aria-label="Store shortcuts"
        onClick={dismissOnNav}
      >
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

        <button
          type="button"
          className="mobile-bottom-nav__item mobile-bottom-nav__brand"
          onClick={() => setSupportOpen((open) => !open)}
          data-cs-trigger="1"
          aria-haspopup="dialog"
          aria-expanded={supportOpen}
          aria-label="Contact support"
        >
          {company?.logo ? (
            <Img
              src={company.logo}
              alt=""
              width={50}
              height={28}
              className="mobile-bottom-nav__brand-logo"
            />
          ) : (
            <FiMessageCircle aria-hidden="true" />
          )}
        </button>

        <button type="button" className="mobile-bottom-nav__item cart-shortcut" onClick={openDrawer} aria-label={cartLabel}>
          <FiShoppingCart aria-hidden="true" />
          <span>Cart</span>
          {count > 0 && <span className="mobile-bottom-nav__badge">{count > 99 ? "99+" : count}</span>}
        </button>

        <Link
          href="/track-order"
          className={cx("mobile-bottom-nav__item", trackActive && "is-active")}
          aria-current={trackActive ? "page" : undefined}
        >
          <FiMapPin aria-hidden="true" />
          <span>Track</span>
        </Link>
      </nav>

      <ContactSupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}