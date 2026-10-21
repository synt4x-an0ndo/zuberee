"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, API_CONFIGURED, imgUrl, listOf, unwrap } from "@/lib/api";
import { applyPalette, buildPalette, DEFAULT_BRAND, normalizeHex, THEME_STORAGE_KEY } from "@/lib/theme";

const SiteContext = createContext(null);

// Coalesce concurrent boot reads (including Strict Mode's effect replay).
// This is NOT a TTL cache: explicit reload/save always starts a fresh request.
let pendingSiteRead = null;
function readSiteResources(fresh) {
  if (!fresh && pendingSiteRead) return pendingSiteRead;
  const request = Promise.allSettled([
    api.get("api/site-settings", { auth: false }),
    api.get("api/footer-settings", { auth: false }),
    api.get("api/social-links-first", { auth: false }),
    api.get("api/categories", { auth: false }),
  ]);
  pendingSiteRead = request;
  request.finally(() => { if (pendingSiteRead === request) pendingSiteRead = null; });
  return request;
}


/**
 * Logo display boxes (px) for every place the logo appears. Admins can
 * override each placement separately in Settings > Store; anything unset
 * falls back to these. The image itself is always fitted with
 * object-fit: contain inside the box, so it is never stretched.
 */
export const DEFAULT_LOGO_SIZES = {
  header: { width: 180, height: 44 },
  footer: { width: 180, height: 44 },
  auth: { width: 200, height: 44 },
  adminSidebar: { width: 180, height: 38 },
  adminLogin: { width: 220, height: 54 },
  invoice: { width: 220, height: 54 },
};

export function normalizeLogoSizes(raw) {
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_LOGO_SIZES)) {
    const w = Number(raw?.[key]?.width);
    const h = Number(raw?.[key]?.height);
    out[key] = {
      width: Number.isInteger(w) && w >= 8 && w <= 800 ? w : def.width,
      height: Number.isInteger(h) && h >= 8 && h <= 400 ? h : def.height,
    };
  }
  return out;
}

function clampFaviconZoom(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 40 && n <= 100 ? n : 85;
}

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
  const generation = useRef(0);
  const [state, setState] = useState({
    loading: API_CONFIGURED,
    error: "",
    settings: null,
    footer: null,
    social: null,
    contactError: "",
    categories: { tree: [], flat: [], bySlug: new Map() },
  });

  const load = useCallback(async (fresh = true) => {
    const id = ++generation.current;
    if (!API_CONFIGURED) {
      setState((s) => ({ ...s, loading: false, error: "API not configured" }));
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const [settings, footer, social, categories] = await readSiteResources(fresh);
    if (generation.current !== id) return;

    const failed = [settings, footer, social, categories].every((r) => r.status === "rejected");
    setState({
      loading: false,
      error: failed ? "The storefront could not reach the server." : "",
      contactError: social.status === "rejected" || footer.status === "rejected"
        ? "Some contact options could not be loaded. Please try again." : "",
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
    load(false);
    return () => { generation.current += 1; };
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
    const name = (state.settings?.site_name || "").trim() || "Zuberee";
    document.title = name;
    const faviconSource = state.settings?.favicon_path || state.footer?.company_logo || state.footer?.logo_path;
    if (faviconSource) {
      const href = imgUrl(faviconSource);
      if (href) {
        let icon = document.querySelector('link[rel="icon"]');
        if (!icon) {
          icon = document.createElement("link");
          icon.rel = "icon";
          document.head.appendChild(icon);
        }
        // The store logo is rarely square; browsers squeeze a non-square
        // favicon into the square tab icon. Pad it (contain, centred) onto a
        // square canvas so the favicon keeps the logo's real proportions.
        // crossOrigin is required: the logo is served by the backend origin,
        // and without CORS approval the canvas is tainted, toDataURL() throws,
        // and the browser falls back to squeezing the raw file. The backend
        // sends Access-Control-Allow-Origin for /storage/* (see its
        // next.config.mjs), which makes this work.
        const image = new Image();
        image.crossOrigin = "anonymous";
        const zoom = clampFaviconZoom(state.settings?.favicon_zoom);
        image.onload = () => {
          try {
            const size = 256;
            const drawable = Math.round((size * zoom) / 100);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            const scale = Math.min(drawable / image.naturalWidth, drawable / image.naturalHeight);
            const w = Math.max(1, Math.round(image.naturalWidth * scale));
            const h = Math.max(1, Math.round(image.naturalHeight * scale));
            ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
            icon.type = "image/png";
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
      contactError: state.contactError,
      backendAvailable: API_CONFIGURED && !state.error && !state.loading,
      settings,
      siteName: (settings.site_name || "").trim() || "Zuberee",
      logoSizes: normalizeLogoSizes(settings.logo_sizes),
      favicon: imgUrl(settings.favicon_path) || "",
      faviconZoom: clampFaviconZoom(settings.favicon_zoom),
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
        messenger: social.messenger || "",
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
