"use client";

import { useEffect, useState } from "react";

const BLOCKED_TAGS = ["script", "iframe", "object", "embed", "style", "link", "meta", "base", "form"];
const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction"];

/**
 * Sanitise admin-authored HTML before rendering: removes executable tags, inline
 * event handlers and javascript: URLs. Runs in the browser only (DOMParser).
 */
export function sanitizeHtml(html) {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  BLOCKED_TAGS.forEach((tag) => doc.querySelectorAll(tag).forEach((node) => node.remove()));
  doc.querySelectorAll("*").forEach((node) => {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      else if (URL_ATTRS.includes(name) && /^(javascript|vbscript):/i.test(value)) node.removeAttribute(attr.name);
    }
    if (node.tagName === "A") {
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
    }
  });
  return doc.body.innerHTML;
}

/** Renders admin-authored rich text. Plain text (no tags) keeps its paragraph breaks. */
export default function SafeHtml({ html, className = "" }) {
  const [clean, setClean] = useState(null);

  useEffect(() => {
    if (!html) {
      setClean("");
      return;
    }
    setClean(/<[a-z][\s\S]*>/i.test(html) ? sanitizeHtml(html) : null);
  }, [html]);

  if (!html || clean === null) {
    if (!html) return null;
    // Plain text (or pre-hydration): readable without any markup.
    return (
      <div className={`rich ${className}`}>
        {String(html).split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
