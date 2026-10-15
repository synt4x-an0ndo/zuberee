"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiBox, FiGrid, FiImage, FiLayers, FiLogOut, FiMenu, FiPackage, FiSettings, FiShoppingBag, FiTag, FiTruck, FiX, FiBarChart2, FiExternalLink, FiUsers, FiUserCheck, FiFileText, FiSliders, FiLink, FiShield, FiActivity } from "react-icons/fi";
import Img from "@/components/Img";
import { cx } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";

const NAV = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: FiGrid, exact: true }] },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: FiShoppingBag },
      { href: "/admin/categories", label: "Categories", icon: FiTag },
      { href: "/admin/sizes", label: "Sizes", icon: FiLayers },
      { href: "/admin/inventory", label: "Inventory", icon: FiPackage },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: FiBox },
      { href: "/admin/sales", label: "Sales report", icon: FiBarChart2 },
      { href: "/admin/customers", label: "Customers", icon: FiUsers },
      { href: "/admin/customer_leaderboard", label: "Customer leaderboard", icon: FiUserCheck },
      { href: "/admin/incomplete_orders", label: "Incomplete orders", icon: FiFileText },
      { href: "/admin/shipping", label: "Shipping costs", icon: FiTruck },
    ],
  },
  {
    label: "Courier Management",
    items: [
      { href: "/admin/fraud-checker", label: "Courier Checker", icon: FiShield },
      { href: "/admin/fraud-checker/plan", label: "Courier Plan & Usage", icon: FiActivity },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/users", label: "Users", icon: FiUsers },
      { href: "/admin/roles", label: "Roles", icon: FiShield },
      { href: "/admin/inventory/movements", label: "Inventory movements", icon: FiActivity },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/admin/banners", label: "Banners", icon: FiImage },
      { href: "/admin/about_us", label: "About us", icon: FiFileText },
      { href: "/admin/footerSettings", label: "Footer settings", icon: FiSliders },
      { href: "/admin/socialLinks", label: "Social links", icon: FiLink },
      { href: "/admin/settings", label: "Settings & theme", icon: FiSettings },
      { href: "/admin/facebook_conversion_api", label: "Facebook conversion API", icon: FiActivity },
    ],
  },
];

function NavList({ pathname, onNavigate }) {
  return (
    <nav aria-label="Admin">
      {NAV.map((group) => (
        <div key={group.label} className="nav-section">
          <p>{group.label}</p>
          {group.items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
            <Link key={item.href} href={item.href} className={cx("side-link", active && "is-active")} aria-current={active ? "page" : undefined} title={item.label} onClick={onNavigate}>
                <item.icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useFeedback();
  const { siteName, company } = useSite();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("zuberee-admin-sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("zuberee-admin-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const signOut = async () => {
    await logout();
    toast.info("Signed out of the admin panel.");
    router.replace("/login/admin/login_eyara_xyz");
  };

  const initials = (user?.name || user?.email || "A").trim().charAt(0).toUpperCase();
  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 1024px)").matches) {
      setOpen(true);
      return;
    }
    setCollapsed((value) => !value);
  };

  return (
    <div className={cx("admin-shell", collapsed && "is-sidebar-collapsed")}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <Link href="/admin" className="admin-brand" aria-label="Admin dashboard">
          {company.logo ? <Img src={company.logo} alt={siteName || "Store logo"} width={220} height={54} priority /> : <span className="brand-name">{siteName || "Store"}</span>}
        </Link>
        <NavList pathname={pathname} />
        <div className="side-foot">
          <Link href="/" className="side-link" target="_blank" rel="noopener">
            <FiExternalLink aria-hidden="true" /> <span>View storefront</span>
          </Link>
          <button type="button" className="side-link" onClick={signOut}>
            <FiLogOut aria-hidden="true" /> <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className={cx("admin-mobile-overlay", open && "is-open")} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={cx("admin-mobile-drawer", open && "is-open")} aria-label="Admin navigation" aria-hidden={!open}>
        <div className="admin-mobile-head">
          {company.logo ? <Img src={company.logo} alt={siteName || "Store logo"} width={180} height={62} priority /> : <span className="brand-name">{siteName || "Store"}</span>}
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><FiX aria-hidden="true" /></button>
        </div>
        <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="icon-btn admin-menu-btn" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
            <FiMenu aria-hidden="true" />
          </button>
          <div className="admin-topbar-title">
            <span className="muted" style={{ fontSize: "0.82rem" }}>{siteName || "Store administration"}</span>
          </div>
          <div className="admin-user">
            <span className="admin-avatar" aria-hidden="true">{initials}</span>
            <span className="admin-user-meta">
              <strong>{user?.name || "Admin"}</strong>
              <span className="muted">{user?.email}</span>
            </span>
          </div>
        </header>
        <main className="admin-content page-enter" key={pathname}>{children}</main>
      </div>
    </div>
  );
}
