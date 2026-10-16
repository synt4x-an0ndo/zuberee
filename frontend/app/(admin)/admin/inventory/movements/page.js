import AdminModulePage from "@/components/admin/AdminModulePage";

/**
 * No backend route exists for inventory movements (/api/inventory/movements returns 404 for
 * every method). Stock levels themselves are available through
 * GET /api/admin/inventory/variants.
 */
export default function InventoryMovementsPage() {
  return (
    <AdminModulePage
      eyebrow="Management"
      title="Inventory movements"
      subtitle="Track stock adjustments, receipts and deductions."
      description="There is no inventory-movement endpoint on the backend yet, so no history can be shown. Current stock per variant is available on the Inventory page."
      columns={["Date", "Product", "Variant", "Movement", "Quantity", "User"]}
      actionLabel={null}
      filters={false}
    />
  );
}
