import AdminModulePage from "@/components/admin/AdminModulePage";

/**
 * No backend route exists for staff user management. Customer records are readable through
 * GET /api/admin/customer-profiles, but there is no endpoint to create or edit users.
 */
export default function UsersPage() {
  return (
    <AdminModulePage
      eyebrow="Management"
      title="Users"
      subtitle="Manage staff accounts and access."
      description="The backend exposes no user-management endpoint, so accounts cannot be created or edited here. Customer records are available on the Customers page."
      columns={["Name", "Email", "Role", "Last login", "Status"]}
      actionLabel={null}
      filters={false}
    />
  );
}
