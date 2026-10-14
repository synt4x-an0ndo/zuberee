import AdminModulePage from "@/components/admin/AdminModulePage";

export default function SocialLinksPage() {
  return <AdminModulePage eyebrow="Storefront" title="Social links" subtitle="Manage the social profiles shown across the storefront." columns={["Network", "URL", "Display order", "Status", "Actions"]} actionLabel="Add link" />;
}
