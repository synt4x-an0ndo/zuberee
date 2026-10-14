"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiRefreshCw } from "react-icons/fi";
import { AdminHeader } from "@/components/admin/AdminPage";
import { Button, Card, CardHeader, ErrorState, Field, Input, Skeleton, Textarea, Toggle, cx } from "@/components/ui";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, imgUrl } from "@/lib/api";
import { DEFAULT_BRAND, THEME_PRESETS, THEME_STORAGE_KEY, applyPalette, buildPalette, normalizeHex } from "@/lib/theme";
import { useAsync } from "@/lib/useAsync";

const TABS = [
  { id: "theme", label: "Theme colour" },
  { id: "store", label: "Store" },
  { id: "contact", label: "Contact & footer" },
  { id: "social", label: "Social links" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("theme");
  const { data, loading, error, reload } = useAsync(async () => {
    const [site, footer, social] = await Promise.all([
      api.get("api/site-settings", { auth: false }),
      api.get("api/footer-settings", { auth: false }),
      api.get("api/social-links", { auth: false }),
    ]);
    return { site: site.data || {}, footer: footer.data || {}, social: social.data || {} };
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
            {tab === "contact" && <ContactPanel initial={data.footer} />}
            {tab === "social" && <SocialPanel initial={data.social} />}
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
      await api.put("api/site-settings", { primary_color: valid });
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

function StorePanel({ initial, footer, onSaved }) {
  const { toast } = useFeedback();
  const { reload: reloadSite } = useSite();
  const [form, setForm] = useState({ site_name: initial.site_name || "", inventory_enforcement_enabled: Boolean(initial.inventory_enforcement_enabled) });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(imgUrl(footer?.company_logo || footer?.logo_path) || "");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("api/site-settings", { site_name: form.site_name.trim(), inventory_enforcement_enabled: form.inventory_enforcement_enabled });
      if (logo) {
        const body = new FormData();
        body.append("company_logo", logo);
        await api.put("api/footer-settings/1", body);
      }
      toast.success("Store settings and branding saved.");
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
      <CardHeader title="Store" />
      <form onSubmit={save} className="stack" style={{ maxWidth: 560 }}>
        <Field label="Store name" htmlFor="st-name" hint="Shown in the header, footer and browser title.">
          <Input id="st-name" value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
        </Field>
        <Field label="Website logo" htmlFor="st-logo" hint="Used in the storefront, admin panel and browser tab favicon.">
          <Input id="st-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setLogo(file);
            if (file) setLogoPreview(URL.createObjectURL(file));
          }} />
          {logoPreview && <img src={logoPreview} alt="Current website logo" style={{ display: "block", maxWidth: 220, maxHeight: 80, objectFit: "contain", marginTop: 10 }} />}
        </Field>
        <Toggle checked={form.inventory_enforcement_enabled} onChange={(v) => setForm({ ...form, inventory_enforcement_enabled: v })} label="Block orders that exceed stock" />
        <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save store settings</Button></div>
      </form>
    </Card>
  );
}

function ContactPanel({ initial }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
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
      await api.put("api/footer-settings/1", form);
      toast.success("Contact details saved.");
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
        <Field label="About the store" htmlFor="ct-desc" hint="Used on the About page and in the footer.">
          <Textarea id="ct-desc" rows={4} value={form.company_description} onChange={set("company_description")} />
        </Field>
        <div className="form-grid">
          <Field label="Email" htmlFor="ct-email"><Input id="ct-email" type="email" value={form.company_email} onChange={set("company_email")} /></Field>
          <Field label="Phone" htmlFor="ct-phone"><Input id="ct-phone" value={form.company_phone} onChange={set("company_phone")} /></Field>
        </div>
        <Field label="Address" htmlFor="ct-addr"><Input id="ct-addr" value={form.company_address} onChange={set("company_address")} /></Field>
        <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save contact details</Button></div>
      </form>
    </Card>
  );
}

function SocialPanel({ initial }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    facebook: initial.facebook || "",
    instagram: initial.instagram || "",
    youtube: initial.youtube || "",
    twitter: initial.twitter || initial.tweeter || "",
    pinterest: initial.pinterest || "",
    whatsapp_number: initial.whatsapp_number || "+880",
  });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("api/social-links", form);
      toast.success("Social links saved.");
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
        </div>
        <div><Button type="submit" variant="primary" loading={busy} disabled={busy}>Save social links</Button></div>
      </form>
    </Card>
  );
}
