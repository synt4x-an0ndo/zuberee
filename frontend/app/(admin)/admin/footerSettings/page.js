import AdminModulePage from "@/components/admin/AdminModulePage";

export default function FooterSettingsPage() {
  return <AdminModulePage eyebrow="Storefront" title="Footer settings" subtitle="Manage footer contact details, links and branding." columns={["Field", "Value", "Last updated", "Status"]} actionLabel="Edit footer" filters={false} />;
}
