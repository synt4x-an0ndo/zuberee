import AdminModulePage from "@/components/admin/AdminModulePage";

export default function AboutUsPage() {
  return <AdminModulePage eyebrow="Storefront" title="About us" subtitle="Manage the story and content shown on the storefront." columns={["Section", "Title", "Last updated", "Status"]} actionLabel="Edit content" filters={false} />;
}
