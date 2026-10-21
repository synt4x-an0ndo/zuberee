"use client";

import UserAvatar from "@/components/UserAvatar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiActivity, FiBarChart2, FiBox, FiExternalLink, FiFileText, FiGrid, FiImage, FiLayers, FiLogOut, FiMenu, FiMessageCircle, FiPackage, FiSettings, FiShield, FiShoppingBag, FiTag, FiTruck, FiUserCheck, FiUsers, FiX } from "react-icons/fi";
import Img from "@/components/Img";
import RoleBadges from "@/components/RoleBadges";
import { requiredAdminPermission } from "@/lib/adminAccess";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { usePermissions } from "@/context/PermissionsContext";
import { useSite } from "@/context/SiteContext";

/** Navigation and direct page access fail closed until permissions are verified. */
const NAV = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: FiGrid, exact: true, permission: "view dashboard" }] },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: FiShoppingBag, permission: "view products" },
      { href: "/admin/categories", label: "Categories", icon: FiTag, permission: "view categories" },
      { href: "/admin/sizes", label: "Sizes", icon: FiLayers, permission: "view sizes" },
      { href: "/admin/inventory", label: "Inventory", icon: FiPackage, exact: true, permission: "manage inventory" },
      { href: "/admin/inventory/movements", label: "Inventory movements", icon: FiActivity, permission: "manage inventory" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: FiBox, permission: "view orders" },
      { href: "/admin/sales", label: "Sales report", icon: FiBarChart2, permission: "view dashboard summary" },
      { href: "/admin/customers", label: "Customers", icon: FiUsers, permission: "view customers" },
      { href: "/admin/chat", label: "Live chat", icon: FiMessageCircle },
      { href: "/admin/customer_leaderboard", label: "Customer leaderboard", icon: FiUserCheck, permission: "view leaderboard" },
      { href: "/admin/incomplete_orders", label: "Incomplete orders", icon: FiFileText, permission: "incomplete_order" },
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
      { href: "/admin/users", label: "Users", icon: FiUsers, permission: "view users" },
      { href: "/admin/roles", label: "Roles", icon: FiShield, permission: "view roles" },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/admin/banners", label: "Banners", icon: FiImage, permission: "view banners" },
      { href: "/admin/about_us", label: "About us", icon: FiFileText },
      { href: "/admin/settings", label: "Settings & theme", icon: FiSettings, permission: "view settings" },
      { href: "/admin/facebook_conversion_api", label: "Facebook conversion API", icon: FiActivity },
    ],
  },
];

function NavList({ pathname, onNavigate, canShow }) {
  return (
    <nav aria-label="Admin">
      {NAV.map((group) => {
        const items = group.items.filter((item) => canShow(requiredAdminPermission(item.href)));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="nav-section">
            <p>{group.label}</p>
            {items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
              <Link key={item.href} href={item.href} className={cx("side-link", active && "is-active")} aria-current={active ? "page" : undefined} title={item.label} onClick={onNavigate}>
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useFeedback();
  const { siteName, company, logoSizes } = useSite();
  const { canShow, can, reload, status, error, loading: permissionsLoading } = usePermissions();
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
    router.replace("/login");
  };

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 1024px)").matches) {
      setOpen(true);
      return;
    }
    setCollapsed((value) => !value);
  };

  // The permission set could not be read. Say so instead of silently hiding or showing
  // sections the caller may or may not have access to.
  const permissionNotice = !permissionsLoading && status === "error" ? error : "";

  return (
    <div className={cx("admin-shell", collapsed && "is-sidebar-collapsed")}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <Link href="/admin" className="admin-brand" aria-label="Admin dashboard">
          {company.logo ? <Img src={company.logo} alt={siteName || "Store logo"} width={logoSizes.adminSidebar.width} height={logoSizes.adminSidebar.height} style={collapsed ? undefined : { width: logoSizes.adminSidebar.width, height: logoSizes.adminSidebar.height, objectFit: "contain" }} priority /> : <span className="brand-name">{siteName || "Store"}</span>}
        </Link>
        <NavList pathname={pathname} canShow={canShow} />
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
          {company.logo ? <Img src={company.logo} alt={siteName || "Store logo"} width={86} height={48} priority /> : <span className="brand-name">{siteName || "Store"}</span>}
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu"><FiX aria-hidden="true" /></button>
        </div>
        <NavList pathname={pathname} onNavigate={() => setOpen(false)} canShow={canShow} />
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
            <span className="admin-avatar" aria-hidden="true"><UserAvatar image={user?.image} width={36} height={36} /></span>
            <span className="admin-user-meta">
              <strong>{user?.name || "Admin"}</strong>
              <span className="muted">{user?.email}</span>
            </span>
            <RoleBadges roles={user?.roles} max={1} showOverflow={false} className="admin-role-badges" />
          </div>
        </header>
        <main className="admin-content page-enter" key={pathname}>
          {permissionNotice ? (
            <div className="notice notice-warn" role="status" style={{ marginBottom: "1rem" }}>
              <p>Your permissions could not be verified. Protected pages and actions are unavailable. {permissionNotice}</p>
            </div>
          ) : null}
          {permissionsLoading ? <Skeleton style={{ height: 240 }} /> : error ? (
            <ErrorState message={`Authorization could not be verified. ${error}`} onRetry={reload} />
          ) : can(requiredAdminPermission(pathname)) ? children : (
            <div className="notice notice-warn" role="alert">
              <p>{requiredAdminPermission(pathname) ? "You do not have permission to open this page." : "No verified permission mapping is available for this page."}</p>
              <Button variant="outline" onClick={reload}>Refresh access</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
