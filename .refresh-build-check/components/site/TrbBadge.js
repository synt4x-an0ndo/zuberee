"use client";

import { FiExternalLink } from "react-icons/fi";

/**
 * TRB - The Raw Bros credit badge.
 *
 * Single source of truth for the developer credit. The storefront footer
 * (components/site/Footer.js) has always carried a "Developed By The Raw Bros"
 * line; this badge surfaces the same credit in smaller, corner-sized form on
 * the chat panel and in the admin panel.
 *
 * variant:
 *   "corner" (default) - compact "TRB" pill for tight corners (chat header).
 *   "inline"           - "TRB . Developed by The Raw Bros" row for sidebars.
 *
 * Colours use currentColor so the badge inherits whatever it is placed on
 * (dark chat header, dark admin sidebar, or a light surface).
 */

export const TRB_URL = "https://therawbros.pages.dev";
export const TRB_NAME = "The Raw Bros";

export default function TrbBadge({ variant = "corner", className = "" }) {
  const inline = variant === "inline";
  const classes = ["trb-badge", inline && "trb-badge--inline", className]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      href={TRB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
      title={`Developed by ${TRB_NAME} - ${TRB_URL}`}
      aria-label={`Developed by ${TRB_NAME} (opens in a new tab)`}
    >
      <span className="trb-mark" aria-hidden="true">TRB</span>
      {inline ? <span className="trb-text">Developed by {TRB_NAME}</span> : null}
      <FiExternalLink className="trb-icon" aria-hidden="true" />
    </a>
  );
}
