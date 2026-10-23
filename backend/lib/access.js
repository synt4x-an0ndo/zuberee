/**
 * Single source of truth for who may use the admin panel.
 *
 * The role lives in one place only: `users.role`. No request consults
 * `user_roles`, `roles` or `role_permissions` - those tables are legacy and are
 * no longer read for authorization.
 *
 *   ADMIN      full access: everything, including users and roles
 *   MODERATOR  the whole admin panel except users and roles
 *   CUSTOMER   the storefront only
 */

export const ROLE = {
    ADMIN: "ADMIN",
    MODERATOR: "MODERATOR",
    CUSTOMER: "CUSTOMER",
};

/** Everything a moderator may do (the old "admin" role). */
export const MODERATOR_PERMISSIONS = [
    "create banners",
    "create categories",
    "create orders",
    "create product variants",
    "create products",
    "create sizes",
    "delete banners",
    "delete categories",
    "delete orders",
    "delete product variants",
    "delete products",
    "delete sizes",
    "download orders",
    "edit banners",
    "edit categories",
    "edit customers",
    "edit orders",
    "edit product variants",
    "edit products",
    "edit settings",
    "edit sizes",
    "incomplete_order",
    "manage inventory",
    "order show",
    "order_status",
    "reOrderImage",
    "update orders",
    "view banners",
    "view categories",
    "view customer details",
    "view customers",
    "view dashboard",
    "view dashboard summary",
    "view leaderboard",
    "view orders",
    "view product variants",
    "view products",
    "view settings",
    "view sizes",
    "view statistics",
];

/** Reserved for ADMIN: user and role management. */
export const ADMIN_ONLY_PERMISSIONS = [
    "assign roles",
    "create roles",
    "create users",
    "delete roles",
    "delete users",
    "edit roles",
    "edit users",
    "view roles",
    "view users",
];

export const ALL_PERMISSIONS = [...MODERATOR_PERMISSIONS, ...ADMIN_ONLY_PERMISSIONS];

/** Anyone allowed into the admin panel at all. */
export function isStaffRole(role) {
    return role === ROLE.ADMIN || role === ROLE.MODERATOR;
}

/** User and role management. */
export function isAdminRole(role) {
    return role === ROLE.ADMIN;
}

export function permissionsForRole(role) {
    if (role === ROLE.ADMIN) return ALL_PERMISSIONS;
    if (role === ROLE.MODERATOR) return MODERATOR_PERMISSIONS;
    return [];
}

/**
 * The three assignable roles, strongest first. `id` is what the admin UI sends
 * back, so it never changes.
 */
export const ROLE_DEFINITIONS = [
    { id: 1, name: "admin", label: "Admin", role: ROLE.ADMIN },
    { id: 2, name: "moderator", label: "Moderator", role: ROLE.MODERATOR },
    { id: 3, name: "user", label: "Customer", role: ROLE.CUSTOMER },
];

export function roleDefinitionFor(role) {
    return ROLE_DEFINITIONS.find((entry) => entry.role === role) || ROLE_DEFINITIONS[2];
}

/** Role names returned to the frontend, e.g. ["admin"]. */
export function roleNamesForRole(role) {
    if (role === ROLE.ADMIN) return ["admin"];
    if (role === ROLE.MODERATOR) return ["moderator"];
    return [];
}

/** Strongest role among the ids the admin UI submitted. */
export function roleFromIds(ids) {
    const list = Array.isArray(ids) ? ids : [];
    if (list.includes(1)) return ROLE.ADMIN;
    if (list.includes(2)) return ROLE.MODERATOR;
    return ROLE.CUSTOMER;
}

/**
 * Badge/label entry for a user's single role. Customers keep the "user" entry
 * so the admin table can show "Customer" instead of an empty cell.
 */
export function getDisplayRoleDefinition(role) {
    return roleDefinitionFor(role);
}
