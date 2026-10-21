"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Modal } from "@/components/ui";
import PermissionPicker from "@/components/admin/PermissionPicker";

/**
 * Create or edit a role.
 *
 * Submits { name, permission_ids } which maps straight onto:
 *   POST /api/admin/roles
 *   PUT  /api/admin/roles/:id
 *
 * PUT replaces the whole permission set, so the modal always sends the complete selection.
 */
export default function RoleFormModal({ open, role, catalog = [], onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const editing = Boolean(role?.id);

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setName(role?.name || "");
    setSelected((role?.permissions || []).map((permission) => permission.name));
  }, [open, role]);

  // name -> id lookup for the payload the backend expects.
  const idByName = useMemo(() => {
    const map = new Map();
    catalog.forEach((permission) => map.set(permission.name, permission.id));
    return map;
  }, [catalog]);

  const submit = async (event) => {
    event?.preventDefault?.();
    if (busy) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a role name.");
      return;
    }

    const permissionIds = Array.from(new Set(selected.map((permissionName) => idByName.get(permissionName)).filter((id) => id !== undefined)));

    setBusy(true);
    setError("");
    try {
      await onSubmit({ name: trimmed, permission_ids: permissionIds });
    } catch (submitError) {
      setError(submitError?.message || "Could not save the role.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={editing ? `Edit role — ${role.name}` : "New role"}
      width="720px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            {editing ? "Save changes" : "Create role"}
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

        <Field label="Role name" htmlFor="role-name" required hint="Names are unique, for example “inventory manager”.">
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Role name"
            autoComplete="off"
            disabled={busy}
          />
        </Field>

        <div>
          <p className="option-label">Permissions</p>
          <PermissionPicker catalog={catalog} selected={selected} onChange={setSelected} disabled={busy} />
        </div>
      </form>
    </Modal>
  );
}
