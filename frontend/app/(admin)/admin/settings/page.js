"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiRefreshCw } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Skeleton, Textarea, Toggle, cx } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { DEFAULT_LOGO_SIZES, useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";
import { DEFAULT_BRAND, THEME_PRESETS, THEME_STORAGE_KEY, applyPalette, buildPalette, normalizeHex } from "@/lib/theme";
import { useAsync } from "@/lib/useAsync";

const TABS = [
  { id: "theme", label: "Theme colour" },
  { id: "store", label: "Store" },
  { id: "contact", label: "Contact & footer" },
  { id: "social", label: "Social links" },
  { id: "chat", label: "Chat & AI" },
];

/**
 * Site / footer / social settings.
 *
 * Endpoints (verified against the running backend):
 *   GET  /api/site-settings           public  -> { data: { site_name, favicon_path, favicon_zoom, logo_sizes, primary_color, inventory_enforcement_enabled, low_stock_threshold } }
 *   PUT  /api/admin/site-settings     ADMIN   <- { site_name?, favicon_path?, favicon_zoom?, logo_sizes?, primary_color?, inventory_enforcement_enabled?, low_stock_threshold? }
 *   GET  /api/footer-settings         public  -> { id, logo_path, company_description, company_address, company_email, company_phone, ... }
 *   PUT  /api/admin/footer-settings   ADMIN   <- upsert (creates the footer row when none exists yet), same fields, JSON only
 *   GET  /api/social-links-first      public  -> { id, facebook, instagram, youtube, twitter, pinterest, whatsapp_number, ... }
 *   PUT  /api/social-links           ADMIN   <- upsert, same fields
 *
 * Note: `/api/site-settings` is GET-only (its write route is PUT /api/admin/site-settings),
 * and the social-links write route sits at /api/social-links even though it is admin-only.
 * The store name lives on site-settings (site_name); the store logo lives on the
 * footer-settings row (logo_path) because the header, footer, favicon and invoices
 * all read it from there, so the Store tab and the Contact & footer tab edit the
 * same logo. Footer saves use the PUT /api/admin/footer-settings upsert so they
 * also work before the first footer row exists.
 * The favicon (favicon_path, falling back to the logo), its zoom inside the
 * square tab icon (favicon_zoom), and the per-placement logo display sizes
 * (logo_sizes: header/footer/auth/adminSidebar/adminLogin/invoice, edited in
 * the Store tab) all live on site-settings too. Components read them via
 * SiteContext (logoSizes / faviconZoom) and fit the image with
 * object-fit: contain, so an admin-set box can never stretch the logo.
 */
export default function SettingsPage() {
  const [tab, setTab] = useState("theme");
  const { data, loading, error, reload } = useAsync(async () => {
    const [site, footer, social] = await Promise.all([
      api.get("api/site-settings", { auth: false }),
      api.get("api/footer-settings", { auth: false }).catch((err) => (err.status === 404 ? null : Promise.reject(err))),
      api.get("api/social-links-first", { auth: false }).catch((err) => (err.status === 404 ? null : Promise.reject(err))),
    ]);
    return {
      site: site?.data || {},
      footer: footer || {},
      social: social || {},
    };
  }, []);

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <AdminHeader eyebrow="Storefront" title="Settings & theme" subtitle="Brand colour, store details, contact information and social links." />

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton style={{ height: 420 }} /> : (
        <>
          <div className="tabs" role="tablist" aria-label="Settings sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx("tab", tab === t.id && "is-active")} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div key={tab} className="anim-fade-in">
            {tab === "theme" && <ThemePanel initial={data.site.primary_color} onSaved={reload} />}
            {tab === "store" && <StorePanel initial={data.site} footer={data.footer} onSaved={reload} />}
            {tab === "contact" && <ContactPanel initial={data.footer} onSaved={reload} />}
            {tab === "social" && <SocialPanel initial={data.social} onSaved={reload} />}
            {tab === "chat" && <ChatAiPanel />}
          </div>
        </>
      )}
    </div>
  );
}

function ThemePanel({ initial, onSaved }) {
  const { toast } = useFeedback();
  const { reload: reloadSite, siteName } = useSite();
  const saved = normalizeHex(initial) || DEFAULT_BRAND;
  const [hex, setHex] = useState(saved);
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const valid = normalizeHex(text);
  const palette = useMemo(() => buildPalette(valid || hex), [valid, hex]);

  // Live preview across the admin UI. Revert to the saved colour when leaving this panel unsaved.
  useEffect(() => {
    applyPalette(palette);
  }, [palette]);
  useEffect(() => () => applyPalette(buildPalette(saved)), [saved]);

  const pick = (value) => {
    const n = normalizeHex(value);
    setText(value);
    if (n) setHex(n);
  };

  const save = async () => {
    if (!valid) return toast.error("Enter a valid hex colour such as #0e2b1b.");
    setBusy(true);
    try {
      await api.put("api/admin/site-settings", { primary_color: valid });
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, valid);
      } catch {
        /* storage may be unavailable; the server value still applies */
      }
      setHex(valid);
      toast.success("Theme colour saved across the store.");
      reloadSite();
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const dirty = valid && valid !== saved;
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
    <div className="grid-2" style={{ alignItems: "start" }}>
      <Card>
        <CardHeader title="Brand colour" subtitle="Changes preview live. Save to publish to the storefront." />
        <div className="stack">
          <div className="color-field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input type="color" aria-label="Pick brand colour" value={hex} onChange={(e) => pick(e.target.value)} style={{ width: 64, height: 52, border: 0, background: "transparent", cursor: "pointer" }} />
            <Field label="Hex value" htmlFor="theme-hex" error={text && !valid ? "Use the form #rrggbb." : ""} className="grow">
              <Input id="theme-hex" value={text} onChange={(e) => pick(e.target.value)} spellCheck={false} className="num" aria-invalid={!!(text && !valid)} />
            </Field>
          </div>

          <div>
            <p className="field-label" style={{ marginBottom: 8 }}>Presets</p>
            <div className="preset-grid">
              {THEME_PRESETS.map((p) => (
                <button key={p.hex} type="button" className={cx("preset", normalizeHex(hex) === p.hex && "is-active")} onClick={() => pick(p.hex)}>
                  <span className="preset-dot" style={{ background: p.hex }} aria-hidden="true" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => pick(saved)} disabled={!dirty && normalizeHex(text) === saved}><FiRefreshCw aria-hidden="true" /> Reset to saved</Button>
            <Button variant="primary" size="lg" loading={busy} disabled={!dirty || busy} onClick={save}><FiCheck aria-hidden="true" /> Save colour</Button>
          </div>
          {!dirty && <p className="muted" style={{ fontSize: "0.88rem" }}>Saved colour: <span className="num">{saved}</span>{saved === DEFAULT_BRAND ? " (Eyara Green)" : ""}</p>}
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
          <CardHeader title="Preview" />
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ background: "var(--brand)", color: "var(--brand-contrast)", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{siteName || "Store"}</strong>
              <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Shop · Sale</span>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 12, background: "var(--paper, #fff)" }}>
              <div style={{ height: 8, borderRadius: 99, background: "var(--brand-soft)" }} />
              <span className="btn btn-primary" style={{ justifySelf: "start" }} aria-hidden="true">Add to cart</span>
              <span className="badge badge-brand" style={{ justifySelf: "start" }}>New arrival</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const LOGO_SIZE_FIELDS = [
  { key: "header", label: "Storefront header" },
  { key: "footer", label: "Storefront footer" },
  { key: "auth", label: "Login & signup pages" },
  { key: "adminSidebar", label: "Admin sidebar" },
  { key: "adminLogin", label: "Admin login screen" },
  { key: "invoice", label: "Printed invoice" },
];

function initialLogoSizes(saved) {
  const out = {};
  for (const { key } of LOGO_SIZE_FIELDS) {
    out[key] = {
      width: saved?.[key]?.width ?? DEFAULT_LOGO_SIZES[key].width,
      height: saved?.[key]?.height ?? DEFAULT_LOGO_SIZES[key].height,
    };
  }
  return out;
}

function StorePanel({ initial, footer, onSaved }) {
  const { toast } = useFeedback();
  const { reload: reloadSite } = useSite();
  const [form, setForm] = useState({
    site_name: initial.site_name || "",
    // The logo is stored on the footer-settings row (logo_path); the header,
    // footer, browser-tab icon and invoices all read it from there.
    logo_path: footer?.logo_path || footer?.company_logo || "",
    favicon_path: initial.favicon_path || "",
    favicon_zoom: initial.favicon_zoom ?? 85,
    logo_sizes: initialLogoSizes(initial.logo_sizes),
    inventory_enforcement_enabled: Boolean(initial.inventory_enforcement_enabled),
    low_stock_threshold: initial.low_stock_threshold ?? 3,
  });
  const [busy, setBusy] = useState(false);

  const setLogoSize = (key, dim) => (e) =>
    setForm({ ...form, logo_sizes: { ...form.logo_sizes, [key]: { ...form.logo_sizes[key], [dim]: e.target.value } } });

  const save = async (e) => {
    e.preventDefault();
    const siteName = form.site_name.trim();
    if (!siteName) {
      return toast.error("Store name cannot be empty.");
    }
    const threshold = Number(form.low_stock_threshold);
    if (!Number.isInteger(threshold) || threshold < 0) {
      return toast.error("Low stock threshold must be a whole number of 0 or more.");
    }
    const logoSizes = {};
    for (const { key, label } of LOGO_SIZE_FIELDS) {
      const width = Number(form.logo_sizes[key].width);
      const height = Number(form.logo_sizes[key].height);
      if (!Number.isInteger(width) || width < 8 || width > 800) {
        return toast.error(`${label} logo width must be a whole number between 8 and 800.`);
      }
      if (!Number.isInteger(height) || height < 8 || height > 400) {
        return toast.error(`${label} logo height must be a whole number between 8 and 400.`);
      }
      logoSizes[key] = { width, height };
    }
    setBusy(true);
    try {
      await api.put("api/admin/site-settings", {
        site_name: siteName,
        favicon_path: form.favicon_path.trim(),
        favicon_zoom: Number(form.favicon_zoom),
        logo_sizes: logoSizes,
        inventory_enforcement_enabled: form.inventory_enforcement_enabled,
        low_stock_threshold: threshold,
      });
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
      return;
    }
    try {
      // Upsert: creates the footer row on first save, updates it afterwards.
      await api.put("api/admin/footer-settings", {
        logo_path: form.logo_path.trim(),
      });
      toast.success("Store settings saved.");
      await reloadSite();
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Store" subtitle="Your store identity, shown across the storefront, plus inventory rules applied at checkout and in the admin stock views." />
      <form onSubmit={save} className="stack" style={{ maxWidth: 560 }}>
        <Field label="Store name" htmlFor="st-name" hint="Shown in the header when no logo is set, in the browser tab title, and in the footer copyright line.">
          <Input id="st-name" value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="e.g. Zuberee" />
        </Field>
        <ImageUploadField
          label="Store logo"
          id="st-store-logo"
          folder="logos"
          hint="Upload the logo from your device (it fills in the path), or paste a logo URL / path. Shown in the header, footer, browser tab icon and invoices. This is the same logo as in Contact & footer."
          value={form.logo_path}
          onChange={(logo_path) => setForm({ ...form, logo_path })}
        />
        <ImageUploadField
          label="Favicon (browser tab icon)"
          id="st-favicon"
          folder="favicons"
          hint="Upload a square icon if you have one (a square PNG works best), or paste an image URL / path. Leave empty to use the store logo as the tab icon."
          value={form.favicon_path}
          onChange={(favicon_path) => setForm({ ...form, favicon_path })}
        />
        <Field label="Favicon size" htmlFor="st-favicon-zoom" hint="How much of the square tab icon the image fills. The image is always kept proportional — never stretched.">
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <input
              id="st-favicon-zoom"
              type="range"
              min="50"
              max="100"
              step="1"
              value={form.favicon_zoom}
              onChange={(e) => setForm({ ...form, favicon_zoom: Number(e.target.value) })}
              style={{ flex: 1 }}
              aria-label="Favicon size in percent"
            />
            <span className="muted" style={{ minWidth: 44, textAlign: "right" }}>{form.favicon_zoom}%</span>
          </div>
        </Field>
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <span style={{ fontWeight: 600 }}>Logo sizes</span>
            <p className="muted" style={{ marginTop: 2 }}>Width × height in pixels for each place the logo appears. The logo is fitted inside the box proportionally, so it is never stretched — make the box wider or taller to give it more room.</p>
          </div>
          {LOGO_SIZE_FIELDS.map(({ key, label }) => (
            <div key={key} className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 150px" }}>{label}</span>
              <Input type="number" min="8" max="800" step="1" aria-label={`${label} logo width`} value={form.logo_sizes[key].width} onChange={setLogoSize(key, "width")} style={{ width: 90 }} />
              <span className="muted" aria-hidden="true">×</span>
              <Input type="number" min="8" max="400" step="1" aria-label={`${label} logo height`} value={form.logo_sizes[key].height} onChange={setLogoSize(key, "height")} style={{ width: 90 }} />
              <span className="muted">px</span>
            </div>
          ))}
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, logo_sizes: initialLogoSizes(null) })}>
              Reset sizes to defaults
            </Button>
          </div>
        </div>
        <Field label="Low stock threshold" htmlFor="st-threshold" hint="Variants at or below this many units are flagged as low stock.">
          <Input id="st-threshold" type="number" min="0" step="1" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
        </Field>
        <Toggle checked={form.inventory_enforcement_enabled} onChange={(v) => setForm({ ...form, inventory_enforcement_enabled: v })} label="Block orders that exceed stock" />
        <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save store settings</Button></div>
      </form>
    </Card>
  );
}

function ContactPanel({ initial, onSaved }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    logo_path: initial.logo_path || "",
    company_description: initial.company_description || "",
    company_address: initial.company_address || "",
    company_email: initial.company_email || "",
    company_phone: initial.company_phone || "",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Upsert route: creates the footer row on first save, updates it after.
      await api.put("api/admin/footer-settings", {
        logo_path: form.logo_path.trim(),
        company_description: form.company_description,
        company_address: form.company_address.trim(),
        company_email: form.company_email.trim(),
        company_phone: form.company_phone.trim(),
      });
      toast.success("Contact details saved.");
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Card>
      <CardHeader title="Contact & footer" subtitle="Shown in the footer and on the contact details of information pages." />
      <form onSubmit={save} className="stack" style={{ maxWidth: 640 }}>
        <ImageUploadField
          label="Company logo"
          id="st-logo"
          folder="logos"
          hint="Upload the logo from your device (it fills in the path), or paste a logo URL / path. This logo is used in the header, footer and invoices."
          value={form.logo_path}
          onChange={(logo_path) => setForm({ ...form, logo_path })}
        />
        <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save contact details</Button></div>
      </form>
    </Card>
  );
}

function SocialPanel({ initial, onSaved }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    facebook: initial.facebook || "",
    instagram: initial.instagram || "",
    youtube: initial.youtube || "",
    twitter: initial.twitter || "",
    pinterest: initial.pinterest || "",
    whatsapp_number: initial.whatsapp_number || "",
    facebook_id: initial.facebook_id || "",
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // PUT /api/social-links is an upsert: it creates the first row when none exists.
      await api.put("api/social-links", {
        facebook: form.facebook.trim(),
        instagram: form.instagram.trim(),
        youtube: form.youtube.trim(),
        twitter: form.twitter.trim(),
        pinterest: form.pinterest.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
        facebook_id: form.facebook_id.trim(),
      });
      toast.success("Social links saved.");
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <Card>
      <CardHeader title="Social links" subtitle="Leave a field empty to hide that icon." />
      <form onSubmit={save} className="stack" style={{ maxWidth: 640 }}>
        <div className="form-grid">
          <Field label="Facebook" htmlFor="so-fb"><Input id="so-fb" placeholder="https://facebook.com/…" value={form.facebook} onChange={set("facebook")} /></Field>
          <Field label="Instagram" htmlFor="so-ig"><Input id="so-ig" placeholder="https://instagram.com/…" value={form.instagram} onChange={set("instagram")} /></Field>
          <Field label="YouTube" htmlFor="so-yt"><Input id="so-yt" placeholder="https://youtube.com/…" value={form.youtube} onChange={set("youtube")} /></Field>
          <Field label="X / Twitter" htmlFor="so-tw"><Input id="so-tw" placeholder="https://x.com/…" value={form.twitter} onChange={set("twitter")} /></Field>
          <Field label="Pinterest" htmlFor="so-pin"><Input id="so-pin" placeholder="https://pinterest.com/…" value={form.pinterest} onChange={set("pinterest")} /></Field>
          <Field label="WhatsApp number" htmlFor="so-wa"><Input id="so-wa" placeholder="+8801XXXXXXXXX" value={form.whatsapp_number} onChange={set("whatsapp_number")} /></Field>
          <Field label="Facebook Pixel ID" htmlFor="so-fbid" hint="Stored with the social links and used by the storefront pixel."><Input id="so-fbid" value={form.facebook_id} onChange={set("facebook_id")} /></Field>
        </div>
        <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save social links</Button></div>
      </form>
    </Card>
  );
}

function ChatAiPanel() {
  const { toast } = useFeedback();
  const [keySet, setKeySet] = useState(null);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("api/admin/site-settings")
      .then((res) => {
        if (!cancelled) setKeySet(Boolean(res?.data?.gemini_api_key_set));
      })
      .catch(() => {
        if (!cancelled) setKeySet(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) {
      return toast.error("Paste a Gemini API key first — or use “Remove key” to clear the saved one.");
    }
    setBusy(true);
    try {
      await api.put("api/admin/site-settings", { gemini_api_key: key });
      setKeySet(true);
      setKeyInput("");
      toast.success("Gemini API key saved. The AI assistant is live.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.put("api/admin/site-settings", { gemini_api_key: "" });
      setKeySet(false);
      setKeyInput("");
      toast.success("Gemini API key removed. The AI assistant is off.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 640 }}>
      <Card>
        <CardHeader
          title="AI shopping assistant (Gemini)"
          subtitle="The “Chat with AI” option in the storefront chat. The assistant answers from your live catalogue — products, prices, sizes, colours and stock — and never invents items."
        />
        <form onSubmit={save} className="stack">
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>Status:</span>
            {keySet === null ? (
              <span className="muted">Checking…</span>
            ) : keySet ? (
              <Badge tone="brand">API key saved — assistant is on</Badge>
            ) : (
              <Badge>Not configured — assistant is off</Badge>
            )}
          </div>
          <Field
            label="Gemini API key"
            htmlFor="st-gemini-key"
            hint="Stored on the server only and never shown again — this box stays empty; type a key to replace the saved one. Get a free key from Google AI Studio (aistudio.google.com/apikey). Runs on the cheapest Gemini model that works (Flash-Lite tier) with automatic fallbacks."
          >
            <Input
              id="st-gemini-key"
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={keySet ? "•••••••••• (saved — type to replace)" : "AIza…"}
            />
          </Field>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>
              Save API key
            </Button>
            {keySet && (
              <Button type="button" variant="ghost" disabled={busy} onClick={remove}>
                Remove key
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Chat with Admin"
          subtitle="Signed-in customers can also pick “Chat with Admin” in the storefront chat and talk to you live."
        />
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Chats are session-only by design: they are kept in the server&apos;s memory, never written to the
            database, and disappear when the customer ends the chat or it sits idle for 30 minutes. There is
            no chat history to review later.
          </p>
          <div>
            <Link href="/admin/chat" className="muted" style={{ textDecoration: "underline" }}>
              Open the Live chat inbox →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
