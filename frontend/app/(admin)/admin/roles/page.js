import AdminModulePage from "@/components/admin/AdminModulePage";

export default function RolesPage() {
  return <AdminModulePage eyebrow="Management" title="Roles & permissions" subtitle="Control what each staff role can access." columns={["Role", "Users", "Permissions", "Updated", "Status"]} actionLabel="Add role" />;
}
