"use client";

import { usePermissions } from "@/context/PermissionsContext";

/**
 * Renders its children only when the signed-in user holds the required permission.
 *
 * The backend stays the source of truth - this only keeps the admin panel free of controls
 * the caller cannot use. The check fails closed: without a verified permission set nothing
 * privileged is rendered.
 *
 *   <PermissionGate permission="assign roles"> ... </PermissionGate>
 *   <PermissionGate any={["edit roles", "delete roles"]}> ... </PermissionGate>
 *   <PermissionGate all={["view roles", "edit roles"]}> ... </PermissionGate>
 */
export default function PermissionGate({ permission, any, all, children, fallback = null }) {
  const { can, canAny, canAll } = usePermissions();

  let allowed;
  if (permission) {
    allowed = can(permission);
  } else if (Array.isArray(all) && all.length > 0) {
    allowed = canAll(all);
  } else if (Array.isArray(any) && any.length > 0) {
    allowed = canAny(any);
  } else {
    allowed = true;
  }

  if (!allowed) return fallback;
  return children;
}
