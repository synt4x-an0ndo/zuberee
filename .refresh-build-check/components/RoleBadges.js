import { FiShield } from "react-icons/fi";
import { Badge, cx } from "@/components/ui";
import { getDisplayRoles } from "@/lib/roleBadges";

/**
 * Renders the non-default RBAC roles assigned to a user.
 *
 * `roles` may be strings from /account/me or role objects from
 * /admin/users. Users with no staff role, or only the default
 * user/customer role, render nothing.
 */
export default function RoleBadges({
  roles,
  max,
  className = "",
  badgeClassName = "",
  showIcon = true,
  showOverflow = true,
}) {
  const displayRoles = getDisplayRoles(roles);
  if (displayRoles.length === 0) return null;

  const limit = Number.isInteger(max) && max > 0 ? max : displayRoles.length;
  const visibleRoles = displayRoles.slice(0, limit);
  const hiddenCount = displayRoles.length - visibleRoles.length;
  const allLabels = displayRoles.map((role) => role.label).join(", ");

  return (
    <span
      className={cx("role-badges", className)}
      aria-label={`Assigned roles: ${allLabels}`}
      title={`Assigned roles: ${allLabels}`}
    >
      {visibleRoles.map((role, index) => (
        <Badge
          key={role.key}
          tone={role.tone}
          className={cx("role-badge", `role-badge-${role.slug}`, badgeClassName)}
        >
          {showIcon && index === 0 ? <FiShield aria-hidden="true" /> : null}
          {role.label}
        </Badge>
      ))}
      {showOverflow && hiddenCount > 0 ? (
        <Badge tone="neutral" className={cx("role-badge", "role-badge-more", badgeClassName)}>
          +{hiddenCount}
        </Badge>
      ) : null}
    </span>
  );
}
