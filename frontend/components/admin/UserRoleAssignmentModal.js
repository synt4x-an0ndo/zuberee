"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { MODERATOR_PERMISSION_GROUPS, MODERATOR_PERMISSIONS_FLAT } from "@/lib/permissions";
import { formatRoleLabel, isDefaultRole } from "@/lib/roleBadges";

/**
 * Assign ONE role to a user (radio buttons - a user holds exactly one role)
 * and, when the role is Moderator, tick which admin areas that account may
 * access.
 *
 * Submits to PATCH /api/admin/users/:id/roles:
 *   { role_ids: [id], permissions?: [...] }
 * `permissions` is sent only for the Moderator role; omitting it (or assigning
 * another role) leaves the moderator unrestricted / clears the grants.
 */
export default function UserRoleAssignmentModal({ open, user, roles = [], onClose, onSubmit }) {
  const [roleId, setRoleId] = useState(null);
  const [granted, setGranted] = useState(() => new Set(MODERATOR_PERMISSIONS_FLAT));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const moderatorRole = useMemo(
    () => roles.find((role) => (role.name || "").toLowerCase() === "moderator") || null,
    [roles]
  );

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    const current = user?.roles?.[0]?.id;
    const fallback = roles.find((role) => isDefaultRole(role.name))?.id ?? 3;
    setRoleId(current ?? fallback);
    const saved = user?.moderatorPermissions;
    setGranted(new Set(Array.isArray(saved) ? saved : MODERATOR_PERMISSIONS_FLAT));
  }, [open, user, roles]);

  const isModerator = roleId !== null && moderatorRole !== null && roleId === moderatorRole.id;

  const effectivePermissions = useMemo(() => {
    const chosen = roles.filter((role) => role.id === roleId);
    const full = chosen.flatMap((role) => (role.permissions || []).map((permission) => permission.name));
    const unique = Array.from(new Set(full));
    if (!isModerator) return unique;
    return unique.filter((name) => granted.has(name));
  }, [roles, roleId, isModerator, granted]);

  const toggle = (permission) => {
    if (busy) return;
    setGranted((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const toggleGroup = (group, checked) => {
    if (busy) return;
    setGranted((current) => {
      const next = new Set(current);
      group.permissions.forEach((name) => {
        if (checked) next.add(name);
        else next.delete(name);
      });
      return next;
    });
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    if (busy) return;
    if (roleId === null) {
      setError("Choose a role first.");
      return;
    }
    if (isModerator && granted.size === 0) {
      setError("Select at least one area the moderator can access.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        role_ids: [roleId],
        ...(isModerator ? { permissions: Array.from(granted) } : {}),
      });
    } catch (submitError) {
      setError(submitError?.message || "Could not update the role.");
      setBusy(false);
    }
  };

  const displayName = user?.name || user?.email || "this user";

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={`Role for ${displayName}`}
      width="640px"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Save role
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
          <p className="notice notice-info">No roles are available yet.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              A user holds exactly one role.
            </p>
            <div className="role-option-list" role="radiogroup" aria-label="Role">
              {roles.map((role) => (
                <label key={role.id} className="role-option">
                  <input
                    type="radio"
                    name="user-role"
                    checked={roleId === role.id}
                    onChange={() => setRoleId(role.id)}
                    disabled={busy}
                  />
                  <span className="role-option-body">
                    <strong>{formatRoleLabel(role.name)}</strong>
                    <span className="muted">
                      {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                      {isDefaultRole(role.name) ? " · default profile (no badge)" : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {isModerator && (
          <div className="stack" style={{ gap: 12 }}>
            <div>
              <strong style={{ fontSize: "0.95rem" }}>Moderator access</strong>
              <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0 0" }}>
                Tick the areas this moderator may use. Unticked areas stay hidden and unavailable for them.
              </p>
            </div>
            {MODERATOR_PERMISSION_GROUPS.map((group) => {
              const allChecked = group.permissions.every((name) => granted.has(name));
              const someChecked = group.permissions.some((name) => granted.has(name));
              return (
                <fieldset
                  key={group.key}
                  style={{ border: "1px solid var(--line, #e4e9e6)", borderRadius: 10, padding: "10px 12px", margin: 0 }}
                >
                  <legend style={{ padding: "0 6px", fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(element) => {
                        if (element) element.indeterminate = !allChecked && someChecked;
                      }}
                      onChange={(event) => toggleGroup(group, event.target.checked)}
                      disabled={busy}
                    />
                    {group.label}
                  </legend>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "6px 12px" }}>
                    {group.permissions.map((name) => (
                      <label
                        key={name}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={granted.has(name)}
                          onChange={() => toggle(name)}
                          disabled={busy}
                        />
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}

        <div className="notice notice-info">
          <p>
            Saving replaces the current assignment
            {effectivePermissions.length > 0
              ? ` · ${effectivePermissions.length} effective permission${effectivePermissions.length === 1 ? "" : "s"}`
              : ""}
            {isModerator ? ` · ${granted.size} of ${MODERATOR_PERMISSIONS_FLAT.length} moderator areas ticked` : ""}.
          </p>
        </div>
      </form>
    </Modal>
  );
}
