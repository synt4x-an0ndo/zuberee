import AdminModulePage from "@/components/admin/AdminModulePage";

/**
 * No backend route exists for roles or permissions. Authentication returns a single `role`
 * string on the user (CUSTOMER / ADMIN), and there is no endpoint to manage roles.
 */
export default function RolesPage() {
  return (
    <AdminModulePage
      eyebrow="Management"
      title="Roles & permissions"
      subtitle="Control what each staff role can access."
      description="The backend has no roles endpoint — each user simply carries a role of CUSTOMER or ADMIN. Staff roles can only be changed directly in the database until an endpoint exists."
      columns={["Role", "Users", "Permissions", "Updated", "Status"]}
      actionLabel={null}
      filters={false}
    />
  );
}
