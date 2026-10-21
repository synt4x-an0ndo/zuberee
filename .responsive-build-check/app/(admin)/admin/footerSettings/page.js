import { redirect } from "next/navigation";

/**
 * Footer/contact settings are edited inside the Settings & theme page's "Contact & footer"
 * tab, which talks to GET /api/footer-settings + PUT /api/admin/footer-settings/:id.
 * Kept as a deep-link alias so old bookmarks keep working.
 */
export default function FooterSettingsAlias() {
  redirect("/admin/settings");
}
