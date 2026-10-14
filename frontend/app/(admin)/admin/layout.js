"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Button, Skeleton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const LOGIN = "/login/admin/login_eyara_xyz";

export default function AdminLayout({ children }) {
  const { user, loading, isAuthenticated, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace(LOGIN);
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="admin-gate">
        <Skeleton style={{ height: 36, width: 240 }} />
        <Skeleton style={{ height: 200, width: "min(520px, 90vw)" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-gate">
        <div className="card card-pad" style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.4rem" }}>Admin access required</h1>
          <p className="muted" style={{ margin: "0.5rem 0 1.25rem" }}>
            You are signed in as {user?.email}, which does not have admin access.
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Button variant="outline" onClick={async () => { await logout(); router.replace(LOGIN); }}>Sign out</Button>
            <Link href="/" className="btn btn-primary">Back to store</Link>
          </div>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
