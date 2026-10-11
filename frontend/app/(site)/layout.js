"use client";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CartDrawer from "@/components/CartDrawer";

/* Storefront styles */
import "@/styles/css/19e5daabf9cb4494.css";
import "@/styles/css/5b92b8a8352367c2.css";
import "@/styles/css/5ff24143f2d57ea6.css";
import "@/styles/account.css";
import "@/styles/storefront-theme.css";

/** Storefront shell: header + content + footer + cart drawer. */
export default function SiteLayout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader />
      <main id="main-content" className="frontMain site-main">
        {children}
      </main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
