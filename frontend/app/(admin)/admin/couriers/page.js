import AdminModulePage from "@/components/admin/AdminModulePage";

export default function CourierManagementPage() {
  return (
    <AdminModulePage
      eyebrow="Sales"
      title="Courier management"
      subtitle="Manage courier partners, delivery assignments and shipment status."
      columns={["Courier", "Phone", "Active deliveries", "Completed", "Status", "Actions"]}
      actionLabel="Add courier"
    />
  );
}
