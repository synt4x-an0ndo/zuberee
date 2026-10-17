"use client";

import { useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiShield, FiTrash2 } from "react-icons/fi";
import PermissionGate from "@/components/admin/PermissionGate";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import RoleFormModal from "@/components/admin/RoleFormModal";
import { Button, EmptyState, ErrorState, Field, Input, Skeleton, Stat } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { usePermissions } from "@/context/PermissionsContext";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { permissionLabel, PERM } from "@/lib/permissions";

export default function RolesPage() {
  const { toast, confirm } = useFeedback();
  const { roles, users, catalog, loading, rolesError, errorStatus, reload, can, catalogError } = usePermissions();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new role
  const [busyId, setBusyId] = useState(null);

  const usersByRole = useMemo(() => {
    const map = new Map();
    users.forEach((entry) => {
      entry.roles.forEach((role) => map.set(role.id, (map.get(role.id) || 0) + 1));
    });
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term
      ? roles.filter(
          (role) =>
            role.name.toLowerCase().includes(term) ||
            role.permissions.some((permission) => permission.name.toLowerCase().includes(term))
        )
      : roles;
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [roles, query]);

  const stats = useMemo(
    () => [
      { label: "Roles", value: roles.length, icon: FiShield },
      { label: "Permissions", value: catalog.length, icon: FiShield },
      { label: "Roles in use", value: usersByRole.size, icon: FiShield },
    ],
    [roles, catalog, usersByRole]
  );

  const saveRole = async (payload) => {
    if (!can(editing?.id ? PERM.EDIT_ROLES : PERM.CREATE_ROLES)) throw new Error("Permission is no longer available.");
    if (catalogError) throw new Error(catalogError);
    if (editing?.id) {
      await api.put(`api/admin/roles/${editing.id}`, payload);
      toast.success(`Role “${payload.name}” updated.`);
    } else {
      await api.post("api/admin/roles", payload);
      toast.success(`Role “${payload.name}” created.`);
    }
    setEditing(null);
    reload();
  };

  const removeRole = async (role) => {
    const assigned = usersByRole.get(role.id) || 0;
    const ok = await confirm({
      title: "Delete this role?",
      message:
        assigned > 0
          ? `“${role.name}” is still assigned to ${assigned} user${assigned === 1 ? "" : "s"}. The backend will refuse to delete it until those assignments are removed.`
          : `“${role.name}” and its ${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"} will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok || !can(PERM.DELETE_ROLES)) return;

    setBusyId(role.id);
    try {
      await api.delete(`api/admin/roles/${role.id}`);
      toast.success(`Role “${role.name}” deleted.`);
      reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const denied = errorStatus === 403;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Management"
        title="Roles & permissions"
        subtitle="Group the permissions staff need, then hand those roles to the right people."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={reload}>
              <FiRefreshCw aria-hidden="true" /> Refresh
            </Button>
            <PermissionGate permission={PERM.CREATE_ROLES}>
              <Button variant="primary" size="sm" onClick={() => setEditing({})}>
                <FiPlus aria-hidden="true" /> New role
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {stats.length > 0 && (
        <div className="stat-grid stagger">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </div>
      )}

      {rolesError ? (
        denied ? (
          <div className="notice notice-warn" role="alert">
            <p>You need the “{PERM.VIEW_ROLES}” permission to view roles.</p>
          </div>
        ) : (
          <ErrorState message={rolesError} onRetry={reload} />
        )
      ) : loading ? (
        <Skeleton style={{ height: 240 }} />
      ) : (
        <section className="card">
          <div className="card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", borderBottom: "1px solid var(--line)" }}>
            <Field label="Search" htmlFor="roles-search">
              <div style={{ position: "relative" }}>
                <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
                <Input
                  id="roles-search"
                  placeholder="Role or permission"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </Field>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={roles.length === 0 ? "No roles yet" : "No roles match your search"}
              text={
                roles.length === 0
                  ? "Create a role to group the permissions a member of staff needs."
                  : "Try a different search term."
              }
              action={
                roles.length === 0 ? (
                  <PermissionGate permission={PERM.CREATE_ROLES}>
                    <Button variant="primary" onClick={() => setEditing({})}>
                      Create role
                    </Button>
                  </PermissionGate>
                ) : null
              }
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th style={{ width: 110 }}>Users</th>
                  <th style={{ width: 140 }}>Updated</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((role) => {
                  const assigned = usersByRole.get(role.id) || 0;
                  return (
                    <tr key={role.id}>
                      <td>
                        <strong>{role.name}</strong>
                        <div className="muted" style={{ fontSize: "0.8rem" }}>{role.guardName || "sanctum"}</div>
                      </td>
                      <td>
                        {role.permissions.length === 0 ? (
                          <span className="muted">No permissions</span>
                        ) : (
                          <>
                            <div className="chip-row">
                              {role.permissions.slice(0, 6).map((permission) => (
                                <span key={permission.id} className="chip">
                                  {permissionLabel(permission.name)}
                                </span>
                              ))}
                              {role.permissions.length > 6 ? (
                                <span className="chip">+{role.permissions.length - 6} more</span>
                              ) : null}
                            </div>
                            <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                              {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={assigned > 0 ? "" : "muted"}>{assigned}</span>
                      </td>
                      <td>
                        <span className="muted">{formatDate(role.updatedAt || role.createdAt)}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <PermissionGate permission={PERM.EDIT_ROLES}>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Edit role ${role.name}`}
                              title="Edit role"
                              onClick={() => setEditing(role)}
                            >
                              <FiEdit2 aria-hidden="true" />
                            </button>
                          </PermissionGate>
                          <PermissionGate permission={PERM.DELETE_ROLES}>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Delete role ${role.name}`}
                              title="Delete role"
                              disabled={busyId === role.id}
                              onClick={() => removeRole(role)}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </section>
      )}

      <RoleFormModal
        open={editing !== null}
        role={editing?.id ? editing : null}
        catalog={catalog}
        onClose={() => setEditing(null)}
        onSubmit={saveRole}
      />
    </div>
  );
}
