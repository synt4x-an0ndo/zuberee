"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { PermissionsProvider } from "@/context/PermissionsContext";

/**
 * Admin route guard. The role check uses the real session user loaded from the
 * backend (GET api/account/me via AuthContext) — never the URL or UI state.
 *  - Session/role still loading: a neutral skeleton — no redirect yet, so the
 *    page never guesses and never flashes unauthorized content.
 *  - Signed out: /login?next=/admin so signing in returns here.
 *  - Signed in as a regular user: /user, every time.
 */
export default function AdminLayout({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login?next=/admin");
      return;
    }
    if (!isAdmin) {
      router.replace("/user");
    }
  }, [loading, isAuthenticated, isAdmin, router]);

  if (loading || !isAuthenticated || !isAdmin) {
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
