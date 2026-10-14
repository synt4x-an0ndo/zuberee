import AdminModulePage from "@/components/admin/AdminModulePage";

export default function InventoryMovementsPage() {
  return <AdminModulePage eyebrow="Management" title="Inventory movements" subtitle="Track stock adjustments, receipts and deductions." columns={["Date", "Product", "Variant", "Movement", "Quantity", "User"]} filters />;
}
