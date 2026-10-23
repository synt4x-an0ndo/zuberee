"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Roles & permissions used to be managed here.
 *
 * Roles are now fixed: Admin, Moderator and Customer, stored on `users.role`.
 * A role is assigned from the Users page, so this route just forwards there to
 * keep old bookmarks working.
 */
export default function RolesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);

  return null;
}
