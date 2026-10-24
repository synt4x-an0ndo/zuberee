/**
 * Single source of truth for who may use the admin panel.
 *
 * The role lives in one place only: `users.role`. No request consults
 * `user_roles`, `roles` or `role_permissions` - those tables are legacy and are
 * no longer read for authorization.
 *
 *   ADMIN      full access: everything, including users and roles
 *   MODERATOR  the admin panel, narrowed by the per-user moderator grants in
 *              `users.moderatorPermissions` (JSON array of permission names;
 *              null means every moderator permission)
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

/** Fast membership checks for moderator grants. */
export const MODERATOR_PERMISSION_SET = new Set(MODERATOR_PERMISSIONS);

/**
 * Moderator permissions grouped for the admin UI, so the admin can tick which
 * areas a moderator may access. The union of every group is exactly
 * MODERATOR_PERMISSIONS.
 */
export const MODERATOR_PERMISSION_GROUPS = [
    {
        key: "dashboard",
        label: "Dashboard & statistics",
        permissions: ["view dashboard", "view dashboard summary", "view statistics", "view leaderboard"],
    },
    {
        key: "products",
        label: "Products",
        permissions: ["view products", "create products", "edit products", "delete products", "manage inventory", "reOrderImage"],
    },
    {
        key: "variants",
        label: "Product variants",
        permissions: ["view product variants", "create product variants", "edit product variants", "delete product variants"],
    },
    {
        key: "categories",
        label: "Categories",
        permissions: ["view categories", "create categories", "edit categories", "delete categories"],
    },
    {
        key: "sizes",
        label: "Sizes",
        permissions: ["view sizes", "create sizes", "edit sizes", "delete sizes"],
    },
    {
        key: "orders",
        label: "Orders",
        permissions: ["view orders", "order show", "create orders", "edit orders", "update orders", "delete orders", "download orders", "order_status", "incomplete_order"],
    },
    {
        key: "customers",
        label: "Customers",
        permissions: ["view customers", "view customer details", "edit customers"],
    },
    {
        key: "banners",
        label: "Banners",
        permissions: ["view banners", "create banners", "edit banners", "delete banners"],
    },
    {
        key: "settings",
        label: "Settings",
        permissions: ["view settings", "edit settings"],
    },
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
 * Parse the `users.moderatorPermissions` column (JSON array of permission
 * names). Returns `null` when unset/unreadable, meaning "unrestricted".
 */
export function parseModeratorPermissions(value) {
    if (Array.isArray(value)) {
        return value.filter((name) => typeof name === "string" && MODERATOR_PERMISSION_SET.has(name));
    }
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.filter((name) => typeof name === "string" && MODERATOR_PERMISSION_SET.has(name));
            }
        } catch {
            /* corrupt column - treat as unrestricted */
        }
    }
    return null;
}

/**
 * Effective permissions for a user, honouring per-moderator grants.
 * - ADMIN: every permission.
 * - MODERATOR: the moderator permissions, narrowed by `moderatorPermissions`
 *   (a JSON array of names on the user row; null = all of them).
 * - CUSTOMER: none.
 */
export function effectivePermissions(role, moderatorPermissions) {
    if (role === ROLE.ADMIN) return ALL_PERMISSIONS;
    if (role !== ROLE.MODERATOR) return [];
    const granted = parseModeratorPermissions(moderatorPermissions);
    if (!granted) return MODERATOR_PERMISSIONS;
    const allow = new Set(granted);
    return MODERATOR_PERMISSIONS.filter((name) => allow.has(name));
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
