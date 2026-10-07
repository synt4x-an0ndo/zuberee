"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FaBars,
  FaChevronDown,
  FaGauge,
  FaBox,
  FaTags,
  FaWarehouse,
  FaRuler,
  FaReceipt,
  FaChartLine,
  FaClockRotateLeft,
  FaUsers,
  FaTrophy,
  FaTruck,
  FaImages,
  FaShieldHalved,
  FaGear,
  FaFileLines,
  FaPalette,
  FaShareNodes,
  FaFacebook,
  FaUserShield,
  FaUserGroup,
  FaArrowUpRightFromSquare as FaExternalLink,
  FaRightFromBracket,
} from "react-icons/fa6";
import { useAdminAuth } from "@/lib/adminAuth";

/* ------------------------------------------------------------------ */
/* Sidebar menu definition - identical to the original admin panel,    */
/* every item gated by API permissions (super-admin sees everything).  */
/* ------------------------------------------------------------------ */
function useMenuDef(auth) {
  const { hasPermission, hasRole } = auth;
  const can = (p) => hasPermission(p);
  const all = (arr) => hasRole("super-admin") || arr.some(can);

  const P = [];

  P.push({
    type: "single",
    href: "/dashboard",
    Icon: FaGauge,
    label: "Dashboard Summary",
    show: can("view dashboard summary") || can("view dashboard"),
  });

  const productsMenu = {
    type: "menu",
    label: "Products Management",
    Icon: FaBox,
    show: all(["view categories", "view products", "manage inventory"]),
    submenus: [
      { href: "/dashboard/category", label: "Category", Icon: FaTags, show: can("view categories") },
      { href: "/dashboard/products", label: "Products", Icon: FaBox, show: can("view products") },
      { href: "/dashboard/inventory", label: "Inventory", Icon: FaWarehouse, show: can("manage inventory") },
    ],
  };
  P.push(productsMenu);

  P.push({
    type: "single",
    href: "/dashboard/sizes",
    Icon: FaRuler,
    label: "Sizes",
    show: can("view sizes"),
  });

  P.push({
    type: "menu",
    label: "Orders",
    Icon: FaReceipt,
    show: can("view orders"),
    submenus: [
      { href: "/dashboard/orders", label: "All Orders", Icon: FaReceipt, show: can("view orders") },
      { href: "/dashboard/sales-report", label: "Sales Report", Icon: FaChartLine, show: can("view orders") },
      { href: "/dashboard/incomplete_orders", label: "Incomplete Orders", Icon: FaClockRotateLeft, show: can("incomplete_order") || can("view orders") },
    ],
  });

  P.push({
    type: "single",
    href: "/dashboard/customers",
    Icon: FaUsers,
    label: "Customers",
    show: can("view customers") || can("view customer details") || can("view leaderboard"),
  });

  P.push({
    type: "single",
    href: "/dashboard/customer_leaderboard",
    Icon: FaTrophy,
    label: "Customer Leaderboard",
    show: can("view leaderboard"),
  });

  P.push({
    type: "single",
    href: "/dashboard/shipping",
    Icon: FaTruck,
    label: "Shipping Cost",
    show: can("view settings"),
  });

  P.push({
    type: "single",
    href: "/dashboard/banners",
    Icon: FaImages,
    label: "Banners",
    show: can("view banners"),
  });

  P.push({
    type: "menu",
    label: "Courier Management",
    Icon: FaTruck,
    show: can("view settings"),
    submenus: [
      { href: "/dashboard/fraud-checker", label: "Courier Checker", Icon: FaShieldHalved, show: can("view settings") },
      { href: "/dashboard/fraud-checker/plan", label: "Courier Plan & Usage", Icon: FaChartLine, show: can("view settings") },
    ],
  });

  P.push({
    type: "menu",
    label: "Settings",
    Icon: FaGear,
    show: can("view settings"),
    submenus: [
      { href: "/dashboard/about_us", label: "About Us", Icon: FaFileLines, show: can("view settings") },
      { href: "/dashboard/footerSettings", label: "Web Settings", Icon: FaGear, show: can("view settings") },
      { href: "/dashboard/theme-settings", label: "Website Color", Icon: FaPalette, show: can("view settings") },
      { href: "/dashboard/socialLinks", label: "Social Links", Icon: FaShareNodes, show: can("view settings") },
      { href: "/dashboard/facebook_conversion_api", label: "Facebook Api Settings", Icon: FaFacebook, show: can("view settings") },
    ],
  });

  P.push({
    type: "menu",
    label: "User Management",
    Icon: FaUserShield,
    roleOnly: true,
    show: hasRole("super-admin"),
    submenus: [
      { href: "/dashboard/users", label: "Users", Icon: FaUserGroup, show: hasRole("super-admin") },
      { href: "/dashboard/roles", label: "Roles & Permissions", Icon: FaUserShield, show: hasRole("super-admin") },
    ],
  });

  P.push({
    type: "single",
    href: "/",
    Icon: FaExternalLink,
    label: "View Website",
    show: true,
  });

  return P.filter((m) =>
    m.type === "single" ? m.show : m.show && m.submenus.some((s) => s.show)
  );
}

/* ------------------------------------------------------------------ */
/* Admin shell: fixed sidebar (colour = API primary) + content        */
/* ------------------------------------------------------------------ */
export default function AdminShell({ children }) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const menu = useMenuDef(auth);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const on = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setOpen(false);
    };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    setMobile(false);
    for (const m of menu) {
      if (m.submenus?.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"))) {
        setExpanded(m.label);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!auth.ready || auth.refreshing) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <span className="spinner-border" style={{ color: "var(--primary-color)" }} />
      </div>
    );
  }
  if (!auth.allowed) {
    return (
      <div className="text-center py-5">
        <h5>Access denied</h5>
        <p className="text-muted">You don&apos;t have permission to view this page.</p>
        <Link href="/dashboard" className="btn btn-grad px-4">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="Dashboard_layout">
      {/* overlay (mobile) */}
      {isMobile && mobile && (
        <div
          className="sidebar-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            zIndex: 999,
          }}
          onClick={() => setMobile(false)}
        />
      )}

      {/* ------------- SIDEBAR ------------- */}
      <div
        className={`sideBarDiv d-flex flex-column ${
          (isMobile ? mobile : open) ? "sidebar-open" : "sidebar-closed"
        } ${isMobile ? "mobile-sidebar" : ""}`}
      >
        <div className="d-flex justify-content-between align-items-center sideBar_icon_siteName">
          <div style={{ display: open || mobile ? "block" : "none", minWidth: 0 }}>
            <Link href="/dashboard">
              <span className="sidebar-brand-logo" aria-hidden="true" />
            </Link>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={() =>
              isMobile ? setMobile((v) => !v) : setOpen((v) => !v)
            }
            aria-label="Toggle sidebar"
          >
            <FaBars className="sideBarIcon" />
          </button>
        </div>

        <div className="sideBar_list mt-4" style={{ overflowY: "auto", flex: 1 }}>
          {menu.length === 0 ? (
            <div className="text-white text-center mt-5 px-3">
              <p className="small">No menu items available</p>
              <p className="small text-muted">Contact administrator</p>
            </div>
          ) : (
            menu.map((item) => {
              if (item.type === "single") {
                const labelVisible = open || mobile;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`d-flex align-items-center gap-2 mb-3 text-white sidebar-item ${
                      isActive(item.href) ? "active" : ""
                    }`}
                    style={{ textDecoration: "none" }}
                    onClick={() => setMobile(false)}
                  >
                    <item.Icon className="text-white" />
                    {labelVisible && <span className="sidebar-label">{item.label}</span>}
                  </Link>
                );
              }
              const labelVisible = open || mobile;
              const isOpen = expanded === item.label;
              return (
                <div key={item.label} className="mb-2">
                  <div
                    className={`sidebar-menu-header d-flex align-items-center justify-content-between gap-2 text-white ${
                      isOpen ? "active" : ""
                    }`}
                    onClick={() => setExpanded(isOpen ? null : item.label)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <item.Icon className="text-white" />
                      {labelVisible && <span className="sidebar-label">{item.label}</span>}
                    </div>
                    {labelVisible && (
                      <FaChevronDown
                        size={10}
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "none",
                          transition: ".2s",
                        }}
                      />
                    )}
                  </div>
                  {isOpen && labelVisible && (
                    <div className="sidebar-submenu">
                      {item.submenus
                        .filter((s) => s.show)
                        .map((s) => (
                          <Link
                            key={s.href}
                            href={s.href}
                            className={`sidebar-item sidebar-subitem d-flex align-items-center gap-2 mb-2 text-white ${
                              isActive(s.href) ? "active" : ""
                            }`}
                            style={{ textDecoration: "none" }}
                            onClick={() => setMobile(false)}
                          >
                            <s.Icon className="text-white" size={13} />
                            <span className="sidebar-label">{s.label}</span>
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ------------- CONTENT ------------- */}
      <div
        className="dashboard_content"
        style={{ marginLeft: isMobile ? 0 : open ? "15rem" : "4rem" }}
      >
        {/* top bar */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <button
            className="btn btn-sm btn-outline-secondary d-md-none"
            onClick={() => setMobile(true)}
          >
            <FaBars />
          </button>
          <div />
          <div className="d-flex align-items-center gap-3">
            <span className="small text-muted d-none d-sm-inline">
              {auth.userName}
            </span>
            <button className="btn btn-sm btn-outline-danger" onClick={auth.logout}>
              <FaRightFromBracket className="me-1" /> Logout
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
