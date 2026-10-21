import AdminModulePage from "@/components/admin/AdminModulePage";
import { COURIER_OPTIONS } from "@/lib/couriers";

/**
 * No backend route exists for courier partners (there is no
 * /api/admin/couriers route), so partners can't be added or edited yet.
 * The built-in list in lib/couriers.js — the same one the order screens
 * use — is listed here with a working search.
 */
export default function CourierManagementPage() {
  const rows = COURIER_OPTIONS.filter((option) => option.value).map((option) => ({
    key: option.value,
    searchText: `${option.label} ${option.value}`,
    cells: [option.label, option.value, "Built-in list"],
  }));

  return (
    <AdminModulePage
      eyebrow="Sales"
      title="Courier management"
      subtitle="Manage courier partners, delivery assignments and shipment status."
      description="Courier partners come from the built-in list in lib/couriers.js used by the order screens. There is no backend endpoint yet, so partners can't be added or edited here — search the built-in list below."
      columns={["Courier", "Code", "Source"]}
      actionLabel={null}
      rows={rows}
    />
  );
}
