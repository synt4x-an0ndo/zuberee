"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, API_BASE, unwrapList, unwrapObject } from "@/lib/api";

const SiteCtx = createContext(null);

function normalizeCategories(categories) {
  const source = Array.isArray(categories) ? categories : [];
  const hasNestedChildren = source.some((category) =>
    (Array.isArray(category.all_children) && category.all_children.length > 0) ||
    (Array.isArray(category.children) && category.children.length > 0)
  );

  if (hasNestedChildren) {
    const normalizeNode = (category) => ({
      ...category,
      all_children: (category.all_children || category.children || []).map(normalizeNode),
    });
    return source.filter((category) => category.parent_id == null && category.parentId == null && !category.parent)
      .map(normalizeNode);
  }

  const nodes = new Map(source.map((category) => [String(category.id), { ...category, all_children: [] }]));
  const roots = [];
  for (const category of source) {
    const node = nodes.get(String(category.id));
    const parentId = category.parent_id ?? category.parentId ?? category.parent?.id ?? null;
    const parent = parentId == null ? null : nodes.get(String(parentId));
    if (parent && parent !== node) parent.all_children.push(node);
    else roots.push(node);
  }
  return roots;
}

function isSafeThemeColor(value) {
  return typeof value === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i.test(value.trim());
}

function hexToRgb(hex) {
  if (!isSafeThemeColor(hex)) return null;
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map((character) => character + character).join("");
  if (value.length === 8) value = value.slice(0, 6);
  const number = Number.parseInt(value, 16);
  return `${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}`;
}

function firstRecord(response) {
  const list = unwrapList(response);
  return list[0] || unwrapObject(response) || null;
}

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [footer, setFooter] = useState(null);
  const [social, setSocial] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const results = await Promise.allSettled([
        api.get("api/site-settings", { auth: false }),
        api.get("api/footer-settings", { auth: false }),
        api.get("api/social-links-first", { auth: false }),
        api.get("api/categories", { auth: false }),
      ]);
      if (!alive) return;

      const [settingsResult, footerResult, socialResult, categoriesResult] = results;
      if (settingsResult.status === "fulfilled") setSettings(unwrapObject(settingsResult.value));
      if (footerResult.status === "fulfilled") setFooter(firstRecord(footerResult.value));
      if (socialResult.status === "fulfilled") setSocial(firstRecord(socialResult.value));
      if (categoriesResult.status === "fulfilled") {
        setCategories(normalizeCategories(unwrapList(categoriesResult.value, ["categories"])));
      }
      setBackendAvailable(results.some((result) => result.status === "fulfilled"));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const primary = isSafeThemeColor(settings?.primary_color) ? settings.primary_color.trim() : "";
  useEffect(() => {
    if (!primary) return;
    const root = document.documentElement;
    root.style.setProperty("--primary-color", primary);
    const rgb = hexToRgb(primary);
    if (rgb) root.style.setProperty("--primary-rgb", rgb);
  }, [primary]);

  const flatCategories = useMemo(() => {
    const output = [];
    const visit = (nodes, level = 0) => {
      (nodes || []).forEach((node) => {
        output.push({ ...node, level });
        visit(node.all_children, level + 1);
      });
    };
    visit(categories);
    return output;
  }, [categories]);

  const company = useMemo(() => ({
    name: settings?.site_name || settings?.company_name || footer?.shop_name || "",
    phone: footer?.company_phone || social?.whatsapp_number || "",
    email: footer?.company_email || "",
    address: footer?.company_address || "",
    description: footer?.company_description || "",
    logo: footer?.logo_path || footer?.company_logo || null,
  }), [settings, footer, social]);

  const value = useMemo(() => ({
    apiBase: API_BASE,
    settings,
    footer,
    social,
    categories,
    flatCategories,
    loading,
    backendAvailable,
    primaryColor: primary,
    company,
  }), [settings, footer, social, categories, flatCategories, loading, backendAvailable, primary, company]);

  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}

export function useSite() {
  const context = useContext(SiteCtx);
  if (!context) throw new Error("useSite must be used inside <SiteProvider>");
  return context;
}
