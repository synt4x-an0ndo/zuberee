import AdminModulePage from "@/components/admin/AdminModulePage";

export default function UsersPage() {
  return <AdminModulePage eyebrow="Management" title="Users" subtitle="Manage staff accounts and access." columns={["Name", "Email", "Role", "Last login", "Status"]} actionLabel="Add user" />;
}
