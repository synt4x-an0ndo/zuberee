"use client";

import { useEffect, useState } from "react";
import { API_BASE, imgUrl } from "@/lib/api";

const ALLOWED_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CAPTION", "CODE", "DD", "DEL", "DIV", "DL", "DT",
  "EM", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "I", "IMG", "LI", "OL",
  "P", "PRE", "S", "SPAN", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TD",
  "TFOOT", "TH", "THEAD", "TR", "U", "UL",
]);

const ALLOWED_ATTRIBUTES = {
  A: new Set(["href", "target", "title", "name", "class"]),
  IMG: new Set(["src", "alt", "title", "width", "height", "class"]),
  OL: new Set(["start", "type", "class"]),
  LI: new Set(["value", "class"]),
  TD: new Set(["colspan", "rowspan", "class"]),
  TH: new Set(["colspan", "rowspan", "scope", "class"]),
};

function safeHref(value) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.startsWith("//")) return "";
  if (/^(https?:|mailto:|tel:)/i.test(candidate)) return candidate;
  if (/^(\/|#|\?)/.test(candidate)) return candidate;
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return "";
  return candidate;
}

function sanitizeMarkup(markup) {
  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(String(markup || ""), "text/html");
  const blockedTags = "script,style,iframe,object,embed,link,meta,form,input,button,svg,math,template";
  documentFragment.querySelectorAll(blockedTags).forEach((element) => element.remove());

  const elements = Array.from(documentFragment.body.querySelectorAll("*"));
  for (const element of elements) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    const allowed = ALLOWED_ATTRIBUTES[element.tagName] || new Set(["class", "title"]);
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcdoc" || !allowed.has(name)) {
        element.removeAttribute(attribute.name);
      }
    }

    if (element.tagName === "A") {
      const href = safeHref(element.getAttribute("href"));
      if (href) element.setAttribute("href", href);
      else element.removeAttribute("href");
      if (element.getAttribute("target") === "_blank") {
        element.setAttribute("rel", "noopener noreferrer");
      } else {
        element.removeAttribute("target");
      }
    }

    if (element.tagName === "IMG") {
      const source = element.getAttribute("src");
      const safeSource = source && /^(https?:)?\/\//i.test(source)
        ? source
        : imgUrl(source);
      if (safeSource) element.setAttribute("src", safeSource);
      else element.remove();
      element.setAttribute("loading", "lazy");
      element.setAttribute("decoding", "async");
    }
  }

  // A content record can be authored by an administrator; relative media should
  // resolve against the configured API rather than the storefront origin.
  if (!API_BASE) {
    documentFragment.body.querySelectorAll("img").forEach((image) => image.remove());
  }
  return documentFragment.body.innerHTML;
}

/** Render API-authored markup only after sanitizing it in the browser. */
export default function SafeHtml({ html, className, ...props }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    setContent(sanitizeMarkup(html));
  }, [html]);

  return (
    <div
      {...props}
      className={className}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
