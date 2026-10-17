"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { permissionsForRoles } from "@/lib/permissions";

/**
 * Assign roles to one user.
 *
 * Submits { role_ids } which maps straight onto:
 *   PATCH /api/admin/users/:id/roles
 *
 * That endpoint *replaces* the user's roles, so the modal always sends the complete set.
 */
export default function UserRoleAssignmentModal({ open, user, roles = [], onClose, onSubmit }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setSelected((user?.roles || []).map((role) => role.id));
  }, [open, user]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const effectivePermissions = useMemo(() => {
    const chosen = roles.filter((role) => selectedSet.has(role.id));
    return permissionsForRoles(chosen);
  }, [roles, selectedSet]);

  const toggle = (roleId) => {
    if (busy) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return Array.from(next);
    });
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({ role_ids: selected });
    } catch (submitError) {
      setError(submitError?.message || "Could not update the roles.");
      setBusy(false);
    }
  };

  const displayName = user?.name || user?.email || "this user";

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={`Roles for ${displayName}`}
      width="640px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Save roles
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="stack" noValidate>
        {error && (
          <p className="notice notice-danger" role="alert">
            {error}
          </p>
        )}

        {user?.email && <p className="muted" style={{ fontSize: "0.88rem" }}>{user.email}</p>}

        {roles.length === 0 ? (
          <p className="notice notice-info">No roles are available yet. Create a role first.</p>
        ) : (
          <div className="role-option-list">
            {roles.map((role) => (
              <label key={role.id} className="role-option">
                <input
                  type="checkbox"
                  checked={selectedSet.has(role.id)}
                  onChange={() => toggle(role.id)}
                  disabled={busy}
                />
                <span className="role-option-body">
                  <strong>{role.name}</strong>
                  <span className="muted">
                    {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="notice notice-info">
          <p>
            Saving replaces the current assignment ({selected.length} role{selected.length === 1 ? "" : "s"} selected
            {effectivePermissions.length > 0 ? `, ${effectivePermissions.length} effective permission${effectivePermissions.length === 1 ? "" : "s"}` : ""}).
          </p>
        </div>
      </form>
    </Modal>
  );
}
