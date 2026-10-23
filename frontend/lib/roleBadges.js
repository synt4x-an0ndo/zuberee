/**
 * Display helpers for assigned RBAC role badges.
 *
 * Badges are presentation only: they are derived from the roles already
 * returned by the backend (user_roles), never from a second source of truth.
 * The seeded default roles ("user" / "customer") intentionally produce no
 * profile badge.
 */

const DEFAULT_ROLE_KEYS = new Set([
  "user",
  "customer",
  "default",
  "defaultuser",
  "customeruser",
]);

const KNOWN_ROLE_LABELS = new Map([
  ["superadmin", "Super Admin"],
  ["admin", "Admin"],
  ["moderator", "Moderator"],
  ["user", "Customer"],
  ["administrator", "Admin"],
  ["ordermanager", "Order Manager"],
  ["Manager", "Manager"],
]);

function compactRoleKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function titleCaseRoleName(name) {
  return String(name || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      // Keep short acronyms such as CEO or IT intact.
      if (/^[A-Z0-9]{2,4}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function rolePriority(key) {
  if (key === "superadmin") return 0;
  if (key === "admin" || key === "administrator") return 10;
  if (key === "moderator") return 15;
  if (key.includes("Manager")) return 20;
  return 30;
}

function roleTone(key) {
  if (key === "superadmin") return "solid";
  if (key === "admin" || key === "administrator") return "brand";
  if (key === "moderator") return "info";
  if (key.includes("Manager")) return "info";
  return "neutral";
}

export function roleNameOf(role) {
  if (typeof role === "string") return role;
  if (!role || typeof role !== "object") return "";
  return role.name || role.label || role.title || "";
}

export function roleKeyOf(role) {
  return compactRoleKey(roleNameOf(role));
}

export function isDefaultRole(role) {
  return DEFAULT_ROLE_KEYS.has(roleKeyOf(role));
}

export function formatRoleLabel(role) {
  const name = roleNameOf(role).trim();
  if (!name) return "";
  return KNOWN_ROLE_LABELS.get(compactRoleKey(name)) || titleCaseRoleName(name);
}

/**
 * Normalizes assigned roles from either API shape:
 *   - /api/account/me and /api/auth/me: ["super-admin", "admin"]
 *   - /api/admin/users: [{ id, name: "super-admin" }, ...]
 *
 * Returns display-ready, de-duplicated roles with default user/customer
 * roles removed and higher-privilege roles first.
 */
export function getDisplayRoles(roles) {
  if (!Array.isArray(roles)) return [];

  const byKey = new Map();

  roles.forEach((role) => {
    const name = roleNameOf(role).trim();
    if (!name) return;

    const key = compactRoleKey(name);
    if (!key || DEFAULT_ROLE_KEYS.has(key) || byKey.has(key)) return;

    const label = formatRoleLabel(name);
    byKey.set(key, {
      key,
      name,
      label,
      slug: label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      tone: roleTone(key),
      priority: rolePriority(key),
    });
  });

  return Array.from(byKey.values()).sort(
    (a, b) => a.priority - b.priority || a.label.localeCompare(b.label)
  );
}

export function getPrimaryRole(roles) {
  return getDisplayRoles(roles)[0] || null;
}
