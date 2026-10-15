"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, API_CONFIGURED, imgUrl, listOf, unwrap } from "@/lib/api";
import { applyPalette, buildPalette, DEFAULT_BRAND, normalizeHex, THEME_STORAGE_KEY } from "@/lib/theme";

const SiteContext = createContext(null);

/** Flat category rows (camelCase from Prisma) -> tree with stable keys. */
function buildCategoryTree(rows) {
  const items = rows
    .filter((row) => row && row.id !== undefined)
    .map((row) => ({
      id: row.id,
      name: row.name || "Untitled",
      slug: row.slug || String(row.id),
      parentId: row.parentId ?? row.parent_id ?? row.parent?.id ?? null,
      priority: Number(row.displayPriority ?? row.priority ?? 0) || 0,
      homepage: Boolean(row.showOnHomepage ?? row.home_category),
      sizeGuideType: row.sizeGuideType ?? row.size_guide_type ?? "NONE",
      productCount: row._count?.products ?? null,
      children: [],
    }));

  const byId = new Map(items.map((item) => [String(item.id), item]));
  const roots = [];
  for (const item of items) {
    const parent = item.parentId == null ? null : byId.get(String(item.parentId));
    if (parent && parent !== item) parent.children.push(item);
    else roots.push(item);
  }

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
    nodes.forEach((node) => sortNodes(node.children));
    return nodes;
  };
  sortNodes(roots);

  const flat = [];
  const visit = (nodes, depth, parentName) => {
    nodes.forEach((node) => {
      flat.push({ ...node, depth, parentName });
      visit(node.children, depth + 1, node.name);
    });
  };
  visit(roots, 0, null);

  return { tree: roots, flat, bySlug: new Map(flat.map((node) => [node.slug, node])) };
}

export function SiteProvider({ children }) {
  const [state, setState] = useState({
    loading: API_CONFIGURED,
    error: "",
    settings: null,
    footer: null,
    social: null,
    categories: { tree: [], flat: [], bySlug: new Map() },
  });

  const load = useCallback(async () => {
    if (!API_CONFIGURED) {
      setState((s) => ({ ...s, loading: false, error: "API not configured" }));
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const [settings, footer, social, categories] = await Promise.allSettled([
      api.get("api/site-settings", { auth: false }),
      api.get("api/footer-settings", { auth: false }),
      api.get("api/social-links-first", { auth: false }),
      api.get("api/categories", { auth: false }),
    ]);

    const failed = [settings, footer, social, categories].every((r) => r.status === "rejected");
    setState({
      loading: false,
      error: failed ? "The storefront could not reach the server." : "",
      settings: settings.status === "fulfilled" ? unwrap(settings.value) || null : null,
      footer: footer.status === "fulfilled" ? unwrap(footer.value) || null : null,
      social: social.status === "fulfilled" ? unwrap(social.value) || null : null,
      categories:
        categories.status === "fulfilled"
          ? buildCategoryTree(listOf(categories.value.data?.categories ? categories.value.data.categories : categories.value))
          : { tree: [], flat: [], bySlug: new Map() },
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Theme: derived from the admin-chosen primary colour.
  const primary = normalizeHex(state.settings?.primary_color);
  useEffect(() => {
    const hex = primary || DEFAULT_BRAND;
    applyPalette(buildPalette(hex));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, hex);
    } catch {
      /* storage unavailable */
    }
  }, [primary]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const name = (state.settings?.site_name || "").trim() || "Store";
    document.title = name;
    if (state.footer?.company_logo || state.footer?.logo_path) {
      const href = imgUrl(state.footer.company_logo || state.footer.logo_path);
      if (href) {
        let icon = document.querySelector('link[rel="icon"]');
        if (!icon) {
          icon = document.createElement("link");
          icon.rel = "icon";
          document.head.appendChild(icon);
        }
        // The store logo is a wide wordmark; browsers squeeze it into the
        // square tab icon. Pad it (contain, centred) onto a square canvas
        // so the favicon keeps the logo's real proportions.
        const image = new Image();
        image.onload = () => {
          try {
            const size = 256;
            const pad = 20;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            const scale = Math.min((size - pad * 2) / image.naturalWidth, (size - pad * 2) / image.naturalHeight);
            const w = Math.max(1, Math.round(image.naturalWidth * scale));
            const h = Math.max(1, Math.round(image.naturalHeight * scale));
            ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
            icon.href = canvas.toDataURL("image/png");
          } catch {
            icon.href = href;
          }
        };
        image.onerror = () => { icon.href = href; };
        image.src = href;
      }
    }
  }, [state.settings, state.footer]);

  const value = useMemo(() => {
    const footer = state.footer || {};
    const social = state.social || {};
    const settings = state.settings || {};
    return {
      loading: state.loading,
      error: state.error,
      backendAvailable: API_CONFIGURED && !state.error && !state.loading,
      settings,
      siteName: (settings.site_name || "").trim(),
      primaryColor: primary || DEFAULT_BRAND,
      inventoryEnforced: Boolean(settings.inventory_enforcement_enabled),
      company: {
        logo: imgUrl(footer.logo_path || footer.company_logo),
        description: footer.company_description || "",
        address: footer.company_address || "",
        email: footer.company_email || "",
        phone: footer.company_phone || "",
      },
      social: {
        facebook: social.facebook || "",
        instagram: social.instagram || "",
        youtube: social.youtube || "",
        twitter: social.twitter || social.tweeter || "",
        pinterest: social.pinterest || "",
        whatsapp: social.whatsapp_number || "",
      },
      categories: state.categories,
      reload: load,
    };
  }, [state, primary, load]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) throw new Error("useSite must be used inside <SiteProvider>");
  return context;
}
