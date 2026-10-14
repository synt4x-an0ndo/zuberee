"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FiBox, FiLogOut, FiSettings, FiUser } from "react-icons/fi";
import { Skeleton, cx } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";

const LINKS = [
  { href: "/user", label: "Overview", icon: FiUser, exact: true },
  { href: "/user/orders", label: "My orders", icon: FiBox },
  { href: "/user/profile", label: "Profile & addresses", icon: FiSettings },
];

export default function AccountLayout({ children }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { toast } = useFeedback();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, isAuthenticated, pathname, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="container section">
        <Skeleton style={{ height: 40, width: 260, marginBottom: 24 }} />
        <Skeleton style={{ height: 300 }} />
      </div>
    );
  }

  const signOut = async () => {
    await logout();
    toast.info("You have been signed out.");
    router.replace("/");
  };

  return (
    <div className="container section account-layout anim-fade-up">
      <aside className="account-nav" aria-label="Account">
        <div className="account-hello">
          <p className="muted" style={{ fontSize: "0.85rem" }}>Signed in as</p>
          <strong>{user?.name || user?.email}</strong>
        </div>
        <nav>
          {LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={cx("side-link", active && "is-active")} aria-current={active ? "page" : undefined}>
                <link.icon aria-hidden="true" /> {link.label}
              </Link>
            );
          })}
          <button type="button" className="side-link" onClick={signOut}>
            <FiLogOut aria-hidden="true" /> Sign out
          </button>
        </nav>
      </aside>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
