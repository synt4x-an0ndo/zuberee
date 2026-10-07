"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/adminAuth";

/**
 * Page-level permission guard.
 * Usage: <PageGate permission="view categories"> ... </PageGate>
 * super-admin always passes.
 */
export default function PageGate({ permission, role, children }) {
  const auth = useAdminAuth({ permission, role, autoRefresh: true });
  if (!auth.ready || auth.refreshing) {
    return (
      <div className="text-center py-5">
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
  return children;
}
