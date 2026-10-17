"use client";

import UserAvatar from "@/components/UserAvatar";
import { useMemo, useState } from "react";
import { FiRefreshCw, FiSearch, FiShield, FiUserCheck } from "react-icons/fi";
import PermissionGate from "@/components/admin/PermissionGate";
import { AdminHeader, DataTable } from "@/components/admin/AdminPage";
import UserRoleAssignmentModal from "@/components/admin/UserRoleAssignmentModal";
import { Button, EmptyState, ErrorState, Field, Input, Select, Skeleton, Stat } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFeedback } from "@/context/FeedbackContext";
import { usePermissions } from "@/context/PermissionsContext";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { byName, PERM, permissionsForRoles } from "@/lib/permissions";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useFeedback();
  const { users, roles, loading, usersError, errorStatus, reload, can } = usePermissions();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [assigning, setAssigning] = useState(null);



  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  const effectiveByUser = useMemo(() => {
    const map = new Map();
    users.forEach((entry) => {
      const owned = entry.roles.map((role) => roleById.get(role.id)).filter(Boolean);
      map.set(entry.id, permissionsForRoles(owned));
    });
    return map;
  }, [users, roleById]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users
      .filter((entry) => {
        if (roleFilter) {
          const id = Number(roleFilter);
          if (!entry.roles.some((role) => role.id === id)) return false;
        }
        if (!term) return true;
        return (
          entry.name.toLowerCase().includes(term) ||
          entry.email.toLowerCase().includes(term) ||
          entry.roles.some((role) => role.name.toLowerCase().includes(term))
        );
      })
      .slice()
      .sort(byName);
  }, [users, query, roleFilter]);

  const stats = useMemo(() => {
    const withRoles = users.filter((entry) => entry.roles.length > 0).length;
    const used = new Set();
    users.forEach((entry) => entry.roles.forEach((role) => used.add(role.id)));
    return [
      { label: "Total users", value: users.length, icon: FiUserCheck },
      { label: "With roles", value: withRoles, icon: FiShield },
      { label: "Roles in use", value: used.size, icon: FiShield },
    ];
  }, [users]);

  const assignRoles = async ({ role_ids }) => {
    if (!assigning || !can(PERM.ASSIGN_ROLES)) throw new Error("Role assignment permission is not verified.");
    await api.patch(`api/admin/users/${assigning.id}/roles`, { role_ids });
    toast.success(`Roles updated for ${assigning.name || assigning.email}.`);
    setAssigning(null);
    // Re-read so the table, the role list and the caller's own permissions stay in sync
    // without forcing a new login.
    reload();
  };

  const denied = errorStatus === 403;

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Management"
        title="Users"
        subtitle="See who can reach the admin panel and control the roles each account holds."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={reload}>
              <FiRefreshCw aria-hidden="true" /> Refresh
            </Button>
            <PermissionGate permission={PERM.ASSIGN_ROLES}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (users.length > 0) setAssigning(users[0]);
                  else toast.info("There are no users to assign roles to yet.");
                }}
              >
                <FiShield aria-hidden="true" /> Assign roles
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

      {usersError ? (
        denied ? (
          <div className="notice notice-warn" role="alert">
            <p>You need the “{PERM.VIEW_USERS}” permission to view this list.</p>
          </div>
        ) : (
          <ErrorState message={usersError} onRetry={reload} />
        )
      ) : loading ? (
        <Skeleton style={{ height: 240 }} />
      ) : (
        <section className="card">
          <div className="card-pad" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", borderBottom: "1px solid var(--line)" }}>
            <Field label="Search" htmlFor="users-search">
              <div style={{ position: "relative" }}>
                <FiSearch aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--muted)" }} />
                <Input
                  id="users-search"
                  placeholder="Name, email or role"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </Field>
            <Field label="Role" htmlFor="users-role">
              <Select
                id="users-role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                placeholder="All roles"
                options={roles.map((role) => ({ value: String(role.id), label: role.name }))}
              />
            </Field>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={users.length === 0 ? "No users yet" : "No users match your filters"}
              text={
                users.length === 0
                  ? "Accounts will appear here once they are created."
                  : "Try a different search term or clear the role filter."
              }
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th style={{ width: 150 }}>Effective permissions</th>
                  <th style={{ width: 130 }}>Joined</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const effective = effectiveByUser.get(entry.id) || [];
                  const isCurrent = currentUser && (currentUser.id === entry.id || currentUser.email === entry.email);
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-cell-avatar" aria-hidden="true">
                            <UserAvatar image={entry.image} width={34} height={34} />
                          </span>
                          <span className="user-cell-text">
                            <strong>
                              {entry.name || "—"}
                              {isCurrent ? <span className="badge badge-brand" style={{ marginLeft: 8 }}>You</span> : null}
                            </strong>
                            <span className="muted">{entry.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        {entry.roles.length === 0 ? (
                          <span className="muted">No roles</span>
                        ) : (
                          <div className="chip-row">
                            {entry.roles.map((role) => (
                              <span key={role.id} className="chip">
                                {role.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="muted">
                          {effective.length} permission{effective.length === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td>
                        <span className="muted">{formatDate(entry.createdAt)}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <PermissionGate permission={PERM.ASSIGN_ROLES}>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Assign roles to ${entry.name || entry.email}`}
                              title="Assign roles"
                              onClick={() => setAssigning(entry)}
                            >
                              <FiShield aria-hidden="true" />
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

      <UserRoleAssignmentModal
        open={assigning !== null}
        user={assigning}
        roles={roles}
        onClose={() => setAssigning(null)}
        onSubmit={assignRoles}
      />
    </div>
  );
}
