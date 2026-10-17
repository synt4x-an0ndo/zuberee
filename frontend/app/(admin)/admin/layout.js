"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { PermissionsProvider } from "@/context/PermissionsContext";

const LOGIN = "/login/admin/login_zuberee_xyz";

export default function AdminLayout({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(LOGIN);
      return;
    }

  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="admin-gate">
        <Skeleton style={{ height: 36, width: 240 }} />
        <Skeleton style={{ height: 200, width: "min(520px, 90vw)" }} />
      </div>
    );
  }



  // PermissionsProvider resolves the signed-in user's effective permissions and keeps them
  // in sync, so the panel can hide what the caller may not use.
  return (
    <PermissionsProvider>
      <AdminShell>{children}</AdminShell>
    </PermissionsProvider>
  );
}
