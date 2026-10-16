import AdminModulePage from "@/components/admin/AdminModulePage";

/**
 * No backend route exists for courier partners. lib/couriers.js is a static list used by the
 * order screens; there is no /api/admin/couriers route (verified: every method returns 404),
 * so this screen stays read-only until the backend adds one.
 */
export default function CourierManagementPage() {
  return (
    <AdminModulePage
      eyebrow="Sales"
      title="Courier management"
      subtitle="Manage courier partners, delivery assignments and shipment status."
      description="No backend endpoint exists for courier partners yet, so no records can be listed or saved here. The courier list used by the order screens ships with the frontend in lib/couriers.js."
      columns={["Courier", "Phone", "Active deliveries", "Completed", "Status", "Actions"]}
      actionLabel={null}
    />
  );
}
