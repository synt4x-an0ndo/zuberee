"use client";

import "@/styles/css/56deab1350a53d9e.css";
import "@/styles/css/dashboard-overflow-fix.css";
import AdminShell from "@/components/admin/AdminShell";

/** Dashboard layout: auth-guarded shell (sidebar + topbar). */
export default function DashboardLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
