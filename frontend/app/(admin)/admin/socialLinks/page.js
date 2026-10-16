import { redirect } from "next/navigation";

/**
 * Social links are edited inside the Settings & theme page's "Social links" tab, which talks
 * to GET /api/social-links-first + PUT /api/admin/social-links.
 * Kept as a deep-link alias so old bookmarks keep working.
 */
export default function SocialLinksAlias() {
  redirect("/admin/settings");
}
