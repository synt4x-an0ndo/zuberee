/**
 * Theme palette.
 *
 * The backend persists one brand colour (site-settings.primary_color). Every other
 * colour used by the storefront and admin is derived from it, so changing the
 * colour in the admin Theme page recolours the whole site.
 */

export const DEFAULT_BRAND = "#0e2b1b";
export const THEME_STORAGE_KEY = "zuberee:brand";

export const THEME_PRESETS = [
  { name: "Zuberee Green", hex: "#0e2b1b" },
  { name: "Ocean", hex: "#0b5d8a" },
  { name: "Terracotta", hex: "#b4532a" },
  { name: "Rose", hex: "#a8325e" },
  { name: "Plum", hex: "#5e2b73" },
  { name: "Charcoal", hex: "#1f2937" },
];

export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return `#${hex}`;
}

function toRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function fromRgb([r, g, b]) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/** Mix colour `a` toward colour `b` by amount t (0..1). */
export function mix(a, b, t) {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return fromRgb(ra.map((channel, i) => channel + (rb[i] - channel) * t));
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function buildPalette(input) {
  const brand = normalizeHex(input) || DEFAULT_BRAND;
  return {
    brand,
    brandDark: mix(brand, "#000000", 0.25),
    brandDeep: mix(brand, "#000000", 0.55),
    brandMid: mix(brand, "#ffffff", 0.6),
    brandSoft: mix(brand, "#ffffff", 0.9),
    brandTint: mix(brand, "#ffffff", 0.95),
    brandContrast: luminance(brand) > 0.42 ? "#111812" : "#ffffff",
    brandRgb: toRgb(brand).join(" "),
  };
}

const CSS_VARS = {
  brand: "--brand",
  brandDark: "--brand-dark",
  brandDeep: "--brand-deep",
  brandMid: "--brand-mid",
  brandSoft: "--brand-soft",
  brandTint: "--brand-tint",
  brandContrast: "--brand-contrast",
  brandRgb: "--brand-rgb",
};

export function applyPalette(palette) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VARS)) {
    root.style.setProperty(cssVar, palette[key]);
  }
}

/** Inline script run before paint so returning visitors never see the default colour flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}',legacy='eyara:brand',h=localStorage.getItem(k)||localStorage.getItem(legacy);if(!h||!/^#[0-9a-f]{6}$/i.test(h))return;localStorage.setItem(k,h);localStorage.removeItem(legacy);var n=parseInt(h.slice(1),16);var r=(n>>16)&255,g=(n>>8)&255,b=n&255;var hex=function(f){return '#'+[r,g,b].map(function(c){return Math.max(0,Math.min(255,Math.round(f(c)))).toString(16).padStart(2,'0')}).join('')};var d=document.documentElement.style;d.setProperty('--brand',h);d.setProperty('--brand-rgb',r+' '+g+' '+b);d.setProperty('--brand-dark',hex(function(c){return c*0.75}));d.setProperty('--brand-deep',hex(function(c){return c*0.45}));d.setProperty('--brand-mid',hex(function(c){return c+(255-c)*0.6}));d.setProperty('--brand-soft',hex(function(c){return c+(255-c)*0.9}));d.setProperty('--brand-tint',hex(function(c){return c+(255-c)*0.95}));d.setProperty('--brand-contrast',(0.2126*r+0.7152*g+0.0722*b)/255>0.5?'#111812':'#ffffff');}catch(e){}})();`;
