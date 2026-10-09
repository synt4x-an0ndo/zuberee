"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, API_BASE, unwrapList, unwrapObject } from "@/lib/api";

/* =====================================================================
 * SiteContext - global site information fetched from the API:
 *  - category tree (navigation + mega menu)        -> GET api/categories
 *  - site settings, footer, and social links       -> public settings APIs
 * ===================================================================== */

const SiteCtx = createContext(null);

function flattenTree(nodes, level = 0, out = []) {
  (nodes || []).forEach((n) => {
    out.push({ ...n, level });
    if (n.all_children?.length) flattenTree(n.all_children, level + 1, out);
  });
  return out;
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
      const [settingsResult, footerResult, socialResult, categoriesResult] =
        await Promise.allSettled([
          api.get("api/site-settings", { auth: false }),
          api.get("api/footer-settings", { auth: false }),
          api.get("api/social-links-first", { auth: false }),
          api.get("api/categories", { auth: false }),
        ]);
      if (!alive) return;
      if (settingsResult.status === "fulfilled") setSettings(unwrapObject(settingsResult.value));
      if (footerResult.status === "fulfilled") {
        const list = unwrapList(footerResult.value);
        setFooter(list[0] || unwrapObject(footerResult.value));
      }
      if (socialResult.status === "fulfilled") {
        setSocial(unwrapList(socialResult.value)[0] || unwrapObject(socialResult.value));
      }
      if (categoriesResult.status === "fulfilled") {
        setCategories(unwrapList(categoriesResult.value, ["categories"]));
      }
      setBackendAvailable(
        [settingsResult, footerResult, socialResult, categoriesResult].some(
          (result) => result.status === "fulfilled"
        )
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Apply the API-provided primary colour as the live CSS theme
     (same mechanism as the original site). */
  const primary = settings?.primary_color || "";
  useEffect(() => {
    if (!settings?.primary_color) return;
    const root = document.documentElement;
    root.style.setProperty("--primary-color", settings.primary_color);
  }, [settings?.primary_color]);

  const flatCategories = useMemo(() => flattenTree(categories), [categories]);

  const value = useMemo(
    () => ({
      apiBase: API_BASE,
      settings,
      footer,
      social,
      categories,
      flatCategories,
      loading,
      backendAvailable,
      primaryColor: primary,
      company: {
        name: settings?.company_name || "",
        phone: footer?.company_phone || social?.whatsapp_number || "",
        email: footer?.company_email || "",
        address: footer?.company_address || "",
        description: footer?.company_description || "",
        logo: footer?.logo_path || null,
      },
    }),
    [settings, footer, social, categories, flatCategories, loading, backendAvailable, primary]
  );

  return <SiteCtx.Provider value={value}>{children}</SiteCtx.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteCtx);
  if (!ctx) throw new Error("useSite must be used inside <SiteProvider>");
  return ctx;
}
