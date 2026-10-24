/**
 * Permission helpers for the admin RBAC screens.
 *
 * The backend stores permissions ("view users", "assign roles", ...) and attaches them to
 * roles; roles are attached to users. The admin UI therefore needs three things:
 *
 *   1. the catalogue of every permission   -> GET /api/admin/permissions
 *   2. the roles with their permissions    -> GET /api/admin/roles
 *   3. the *effective* permission set of the signed-in user.
 *
 * There is no endpoint that returns #3 directly, so it is derived from #1/#2 the same way
 * the backend's own getUserRolesAndPermissions() helper does it on the server: look up the
 * signed-in user's roles, then union the permissions of those roles.
 *
 * The derived set is never assumed. When the endpoints cannot be read the set is empty and
 * every privileged control stays hidden.
 */

/** Permission names used by the admin screens (mirrors backend/prisma/seed-rbac.js). */
export const PERM = {
  VIEW_USERS: "view users",
  CREATE_USERS: "create users",
  EDIT_USERS: "edit users",
  DELETE_USERS: "delete users",
  VIEW_ROLES: "view roles",
  CREATE_ROLES: "create roles",
  EDIT_ROLES: "edit roles",
  DELETE_ROLES: "delete roles",
  ASSIGN_ROLES: "assign roles",
};

const toId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** GET /api/admin/users -> one user record. */
export function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = toId(raw.id);
  if (id === null) return null;
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  return {
    id,
    name: raw.name || "",
    email: raw.email || "",
    image: raw.image || null,
    moderatorPermissions: parsePermissionList(raw.moderator_permissions),
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null,
    roles: roles
      .map((role) => ({
        id: toId(role?.id),
        name: role?.name || "",
        guardName: role?.guard_name || role?.guardName || "",
      }))
      .filter((role) => role.id !== null),
  };
}

/** GET /api/admin/roles -> one role record, including its permission pivot rows. */
export function normalizeRole(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = toId(raw.id);
  if (id === null) return null;
  const permissions = Array.isArray(raw.permissions) ? raw.permissions : [];
  return {
    id,
    name: raw.name || "",
    guardName: raw.guard_name || raw.guardName || "",
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null,
    permissions: permissions
      .map((permission) => ({
        id: toId(permission?.id),
        name: permission?.name || "",
        guardName: permission?.guard_name || permission?.guardName || "",
      }))
      .filter((permission) => permission.id !== null),
  };
}

/** GET /api/admin/permissions -> one permission record. */
export function normalizePermission(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = toId(raw.id);
  if (id === null) return null;
  return {
    id,
    name: raw.name || "",
    guardName: raw.guard_name || raw.guardName || "",
  };
}

/**
 * The effective permissions of one user, computed from the roles they hold.
 * Mirrors backend/lib/permissions.js -> getUserRolesAndPermissions().
 */
export function permissionsForRoles(roles) {
  const names = new Set();
  (roles || []).forEach((role) => {
    (role?.permissions || []).forEach((permission) => {
      if (permission?.name) names.add(permission.name);
    });
  });
  return Array.from(names).sort();
}

/**
 * Effective permissions of the signed-in user.
 * The user is matched by id first (from GET /api/account/me) and by email as a fallback.
 */
export function deriveEffectivePermissions({ users = [], roles = [], userId = null, email = "" } = {}) {
  const target = String(email || "").trim().toLowerCase();
  const me = users.find((user) => {
    if (userId !== null && userId !== undefined && user.id === userId) return true;
    return Boolean(target) && String(user.email || "").trim().toLowerCase() === target;
  });
  if (!me) return [];
  const roleIds = new Set(me.roles.map((role) => role.id));
  return permissionsForRoles(roles.filter((role) => roleIds.has(role.id)));
}

export function hasPermission(permissions, name) {
  if (!Array.isArray(permissions) || !name) return false;
  return permissions.includes(name);
}

export function hasAnyPermission(permissions, names) {
  if (!Array.isArray(names) || names.length === 0) return false;
  return names.some((name) => hasPermission(permissions, name));
}

/**
 * Groups the permission catalogue for the picker: "view products" and "create products"
 * both land in the "products" group, "view product variants" in "product variants".
 */
export function groupPermissions(permissions) {
  const groups = new Map();
  (permissions || []).forEach((permission) => {
    const words = String(permission?.name || "").split(" ").filter(Boolean);
    const group = words.length > 1 ? words.slice(1).join(" ") : "general";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(permission);
  });
  return Array.from(groups.entries())
    .map(([group, items]) => ({
      group,
      items: items
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => item.name),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

/** Human label for a permission name: "view products" -> "View products". */
export function permissionLabel(name) {
  const text = String(name || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Sort helper for the users table: name, then email, case-insensitively. */
export function byName(a, b) {
  const left = (a?.name || a?.email || "").toLowerCase();
  const right = (b?.name || b?.email || "").toLowerCase();
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Per-moderator access grants come back from the API as an array of permission
 * names, or null when the moderator is unrestricted (every moderator
 * permission). Mirrors backend/lib/access.js parseModeratorPermissions().
 */
function parsePermissionList(value) {
  if (Array.isArray(value)) return value.filter((name) => typeof name === "string");
  return null;
}

/**
 * Moderator permissions grouped for the "Moderator access" checklist in the
 * user role modal. Keep in sync with backend/lib/access.js
 * MODERATOR_PERMISSION_GROUPS - the union is exactly the moderator set.
 */
export const MODERATOR_PERMISSION_GROUPS = [
  { key: "dashboard", label: "Dashboard & statistics", permissions: ["view dashboard", "view dashboard summary", "view statistics", "view leaderboard"] },
  { key: "products", label: "Products", permissions: ["view products", "create products", "edit products", "delete products", "manage inventory", "reOrderImage"] },
  { key: "variants", label: "Product variants", permissions: ["view product variants", "create product variants", "edit product variants", "delete product variants"] },
  { key: "categories", label: "Categories", permissions: ["view categories", "create categories", "edit categories", "delete categories"] },
  { key: "sizes", label: "Sizes", permissions: ["view sizes", "create sizes", "edit sizes", "delete sizes"] },
  { key: "orders", label: "Orders", permissions: ["view orders", "order show", "create orders", "edit orders", "update orders", "delete orders", "download orders", "order_status", "incomplete_order"] },
  { key: "customers", label: "Customers", permissions: ["view customers", "view customer details", "edit customers"] },
  { key: "banners", label: "Banners", permissions: ["view banners", "create banners", "edit banners", "delete banners"] },
  { key: "settings", label: "Settings", permissions: ["view settings", "edit settings"] },
];

export const MODERATOR_PERMISSIONS_FLAT = MODERATOR_PERMISSION_GROUPS.flatMap((group) => group.permissions);
