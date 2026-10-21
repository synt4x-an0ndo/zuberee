/**
 * Shared helpers for the admin customer screens.
 *
 * The customer endpoints (leaderboard / profiles / statistics) are all derived on the
 * backend by grouping orders by `user:<id>` for signed-in buyers and `guest:<phone>` for
 * guest checkouts. The leaderboard response does not echo that key back, so the badge
 * endpoint needs it rebuilt from a user id or a phone number.
 */

export const BADGE_OPTIONS = [
  { value: "", label: "No badge" },
  { value: "vip", label: "VIP" },
  { value: "repeat", label: "Repeat customer" },
  { value: "priority", label: "Priority" },
  { value: "high-value", label: "High value" },
  { value: "risky", label: "Risky" },
];

const BADGE_TONES = {
  vip: "brand",
  repeat: "info",
  priority: "warn",
  "high-value": "success",
  risky: "danger",
};

export function badgeTone(value) {
  if (!value) return "neutral";
  return BADGE_TONES[String(value).toLowerCase()] || "info";
}

export function badgeLabel(value) {
  if (!value) return "";
  const match = BADGE_OPTIONS.find((option) => option.value === String(value).toLowerCase());
  return match?.label || String(value);
}

/**
 * Build the `:key` path segment for
 * PATCH /api/admin/customer-leaderboard/:key/badge.
 * Returns null when neither a user id nor a phone number is available.
 */
export function badgeKey({ user_id, userId, phone } = {}) {
  const id = user_id ?? userId;
  if (id !== undefined && id !== null && id !== "") return `user:${id}`;
  const digits = String(phone ?? "").trim();
  if (digits) return `guest:${digits}`;
  return null;
}

export function badgeKeyFromProfile(profile) {
  if (!profile) return null;
  if (profile.has_user_account && profile.user_id) return `user:${profile.user_id}`;
  return badgeKey({ phone: profile.phone });
}

/** Encoded URL segment for the badge route. */
export function badgePath(key) {
  return `api/admin/customer-leaderboard/${encodeURIComponent(key)}/badge`;
}
