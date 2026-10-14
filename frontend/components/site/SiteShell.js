"use client";

import { usePathname } from "next/navigation";
import CartDrawer from "@/components/site/CartDrawer";
import Footer from "@/components/site/Footer";
import Header from "@/components/site/Header";
import MobileBottomNav from "@/components/site/MobileBottomNav";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";

export default function SiteShell({ children }) {
  const pathname = usePathname();
  const site = useSite();
  const { drawerOpen } = useCart();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" key={pathname} className="page-enter" style={{ minHeight: "60vh" }}>
        {children}
      </main>
      <Footer siteName={site.siteName} company={site.company} social={site.social} roots={site.categories.tree} />
      {!drawerOpen && <MobileBottomNav />}
      {drawerOpen && <CartDrawer />}
    </>
  );
}
