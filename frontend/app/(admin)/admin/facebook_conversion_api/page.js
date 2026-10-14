import AdminModulePage from "@/components/admin/AdminModulePage";

export default function FacebookConversionApiPage() {
  return <AdminModulePage eyebrow="Storefront" title="Facebook conversion API" subtitle="Configure server-side event tracking for your storefront." columns={["Setting", "Value", "Last updated", "Status"]} actionLabel="Configure" filters={false} />;
}
