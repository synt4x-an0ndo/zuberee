"use client";

/**
 * Website Color — standalone theme page (Zuberee parity).
 *
 * Zuberee reference: GET /dashboard/theme-settings ("Website Color", Settings menu).
 * Zuberee already has the same control as the "Theme colour" tab of
 * Admin -> Settings & theme; this route exists so the Zuberee URL structure is
 * fully covered and the colour control can be linked/bookmarked on its own.
 *
 * FRONTEND ONLY (backend API to be wired by the backend dev, no UI change needed):
 *   GET  /api/site-settings            -> { data: { primary_color } }
 *   PUT  /api/admin/site-settings      <- { primary_color }
 * Those are the exact calls Admin -> Settings & theme already makes. Until
 * they answer on this deployment, the picker still previews live and keeps
 * the choice in this browser (localStorage, same key as lib/theme.js).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheck, FiInfo, FiRefreshCw } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, Field, Input, Skeleton, cx } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";
import { DEFAULT_BRAND, THEME_STORAGE_KEY, applyPalette, buildPalette, normalizeHex } from "@/lib/theme";

/** Presets from the live Zuberee "Website Color" page, plus Zuberee's default. */
const ZUBEREE_PRESETS = [
  { name: "Zuberee Green", hex: DEFAULT_BRAND },
  { name: "Zuberee Purple", hex: "#7d0ba7" },
  { name: "Coral Pink", hex: "#eb3b5a" },
  { name: "Classic Red", hex: "#db3340" },
  { name: "Royal Blue", hex: "#1d4ed8" },
  { name: "Emerald", hex: "#059669" },
  { name: "Sunset Orange", hex: "#ea580c" },
  { name: "Hot Pink", hex: "#db2777" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Gold", hex: "#ca8a04" },
  { name: "Charcoal", hex: "#1f2937" },
];

export default function ThemeSettingsPage() {
  const { toast } = useFeedback();
  const { reload: reloadSite, siteName } = useSite();
  const [saved, setSaved] = useState(DEFAULT_BRAND);
  const [hex, setHex] = useState(DEFAULT_BRAND);
  const [text, setText] = useState(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);
  const [busy, setBusy] = useState(false);

  const valid = normalizeHex(text);
  const palette = useMemo(() => buildPalette(valid || hex), [valid, hex]);
  const dirty = Boolean(valid && valid !== saved);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = await api.get("api/site-settings", { auth: false });
        const colour = normalizeHex(body?.data?.primary_color) || DEFAULT_BRAND;
        if (!alive) return;
        setSaved(colour);
        setHex(colour);
        setText(colour);
      } catch {
        if (!alive) return;
        setBackendReady(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Live preview across the admin UI; revert to the saved colour on leave.
  useEffect(() => {
    applyPalette(palette);
  }, [palette]);
  useEffect(() => () => applyPalette(buildPalette(saved)), [saved]);

  const pick = (value) => {
    setText(value);
    const normalised = normalizeHex(value);
    if (normalised) setHex(normalised);
  };

  const save = async () => {
    if (!valid) return toast.error("Enter a valid hex colour such as #0e2b1b.");
    setBusy(true);
    try {
      await api.put("api/admin/site-settings", { primary_color: valid });
      setSaved(valid);
      setHex(valid);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, valid);
      } catch {
        /* storage may be unavailable; the server value still applies */
      }
      toast.success("Website color saved. The storefront now uses this color.");
      reloadSite();
    } catch {
      // Backend endpoint not connected yet: keep the page fully usable as a
      // frontend preview instead of faking a server save.
      setSaved(valid);
      setHex(valid);
      setBackendReady(false);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, valid);
      } catch {
        /* ignore */
      }
      toast.info("Colour applied in this browser only — the backend site-settings API is not connected yet.");
    } finally {
      setBusy(false);
    }
  };

  const swatches = [
    ["Brand", palette.brand],
    ["Dark", palette.brandDark],
    ["Deep", palette.brandDeep],
    ["Mid", palette.brandMid],
    ["Soft", palette.brandSoft],
    ["Tint", palette.brandTint],
    ["Text on brand", palette.brandContrast],
  ];

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader
        eyebrow="Settings"
        title="Website Color"
        subtitle="Pick a brand color. Buttons, menus, links, and highlights across the whole website will follow it."
        actions={
          <Button variant="ghost" href="/admin/settings">
            <FiArrowLeft aria-hidden="true" /> Settings &amp; theme
          </Button>
        }
      />

      {!backendReady && (
        <div className="notice notice-info" role="note" style={{ display: "flex", gap: 10 }}>
          <FiInfo aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Frontend only for now: the saved colour could not be loaded from the backend, so this page is
            previewing locally. Backend dev — wire <span className="num">GET /api/site-settings</span> and{" "}
            <span className="num">PUT /api/admin/site-settings {"{ primary_color }"}</span> and this page
            works unchanged.
          </span>
        </div>
      )}

      {loading ? (
        <Skeleton style={{ height: 420 }} />
      ) : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Card>
            <CardHeader title="Website color picker" subtitle="Changes preview live. Save to publish to the storefront." />
            <div className="stack">
              <div className="color-field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  type="color"
                  aria-label="Choose color"
                  value={hex}
                  onChange={(e) => pick(e.target.value)}
                  style={{ width: 64, height: 52, border: 0, background: "transparent", cursor: "pointer" }}
                />
                <Field label="Hex code" htmlFor="theme-settings-hex" error={text && !valid ? "Use the form #rrggbb." : ""} className="grow">
                  <Input id="theme-settings-hex" value={text} onChange={(e) => pick(e.target.value)} spellCheck={false} className="num" aria-invalid={!!(text && !valid)} />
                </Field>
              </div>

              <div>
                <p className="field-label" style={{ marginBottom: 8 }}>Presets</p>
                <div className="preset-grid">
                  {ZUBEREE_PRESETS.map((preset) => (
                    <button
                      key={preset.hex + preset.name}
                      type="button"
                      className={cx("preset", normalizeHex(hex) === preset.hex && "is-active")}
                      onClick={() => pick(preset.hex)}
                    >
                      <span className="preset-dot" style={{ background: preset.hex }} aria-hidden="true" />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => pick(saved)} disabled={!dirty && normalizeHex(text) === saved}>
                  <FiRefreshCw aria-hidden="true" /> Reset to saved
                </Button>
                <Button variant="primary" size="lg" loading={busy} disabled={!dirty || busy} onClick={save}>
                  <FiCheck aria-hidden="true" /> Save website color
                </Button>
              </div>
              {!dirty && (
                <p className="muted" style={{ fontSize: "0.88rem" }}>
                  Saved colour: <span className="num">{saved}</span>
                  {saved === DEFAULT_BRAND ? " (Zuberee Green)" : ""}
                </p>
              )}
            </div>
          </Card>

          <div className="stack" style={{ gap: "1.25rem" }}>
            <Card>
              <CardHeader title="Derived palette" subtitle="Shades are generated from the brand colour." />
              <ul className="palette-strip" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {swatches.map(([label, value]) => (
                  <li key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 44, height: 28, borderRadius: 8, background: value, border: "1px solid var(--line)" }} aria-hidden="true" />
                    <span style={{ flex: 1 }}>{label}</span>
                    <span className="num muted">{value}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Live preview" />
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
                <div style={{ background: "var(--brand)", color: "var(--brand-contrast)", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{siteName || "Zuberee Fashion"}</strong>
                  <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Shop · Sale</span>
                </div>
                <div style={{ padding: 20, display: "flex", gap: 10, flexWrap: "wrap", background: "var(--paper, #fff)" }}>
                  <span className="btn btn-primary" aria-hidden="true">Add to Cart</span>
                  <span className="btn btn-outline" aria-hidden="true">View Details</span>
                  <span className="btn btn-primary" aria-hidden="true">Buy Now</span>
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.88rem", marginTop: 12 }}>
                Same control as <Link href="/admin/settings">Settings &amp; theme</Link>, on its own page like Zuberee.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
