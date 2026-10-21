"use client";

import { useEffect, useRef, useState } from "react";
import { FaFacebookMessenger, FaWhatsapp } from "react-icons/fa";
import { FiPhone, FiX } from "react-icons/fi";
import useExitPresence from "@/lib/useExitPresence";
import ViewportPortal from "@/components/ViewportPortal";
import { useSite } from "@/context/SiteContext";

// Configuration only: never manufacture contact details or accept script URLs.
export function telHref(raw) {
  const value = String(raw || "").trim().replace(/^tel:/i, "");
  if (!/^\+?[\d\s().-]+$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits) ? `tel:${value.startsWith("+") ? "+" : ""}${digits}` : "";
}

function webHref(raw, hosts) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return "";
    if (!hosts.includes(url.hostname.toLowerCase()) || url.pathname === "/") return "";
    return url.href;
  } catch {
    return "";
  }
}

export function messengerHref(raw) {
  return webHref(raw, ["m.me", "www.m.me", "messenger.com", "www.messenger.com", "facebook.com", "www.facebook.com", "m.facebook.com"]);
}

export function waHref(raw) {
  const value = String(raw || "").trim();
  const url = webHref(value, ["wa.me", "api.whatsapp.com", "web.whatsapp.com", "www.whatsapp.com", "whatsapp.com"]);
  if (url) return url; // Preserve configured phone, message and other query parameters.
  const phone = telHref(value);
  return phone ? `https://wa.me/${phone.slice(4).replace(/\D/g, "")}` : "";
}

export default function ContactSupportModal({ open, onClose }) {
  const { company, social, loading, error, contactError, reload } = useSite();
  const [mobile, setMobile] = useState(false);
  const present = useExitPresence(open && mobile);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!present || !mobile) return undefined;
    const previous = document.activeElement;
    const closeButton = closeRef.current;
    closeButton?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Do not steal focus from a different navigation control the user tapped.
      if (document.activeElement === document.body || document.activeElement === closeButton) {
        if (previous?.isConnected) previous.focus();
      }
    };
  }, [present, mobile]);

  if (!present || !mobile) return null;

  const actions = [
    { key: "messenger", label: "Messenger", href: messengerHref(social?.messenger), Icon: FaFacebookMessenger },
    { key: "whatsapp", label: "WhatsApp", href: waHref(social?.whatsapp), Icon: FaWhatsapp },
    // Social Links has no phone field: reuse the existing footer contact mapping.
    { key: "call", label: "Call", href: telHref(company?.phone), Icon: FiPhone },
  ];
  const message = loading ? "Loading contact options…"
    : contactError || error || (actions.every(action => !action.href) ? "Contact options are not configured yet." : "");

  return (
    <ViewportPortal>
      <div className={`cs-overlay${!open ? " is-closing" : ""}`} onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}>
        <div className={`cs-card${!open ? " is-closing" : ""}`} role="dialog" aria-labelledby="cs-title" aria-busy={loading || undefined}>
          <div className="cs-head">
            <h2 className="cs-title" id="cs-title">Contact Support</h2>
            <button type="button" className="cs-close" onClick={onClose} aria-label="Close contact support" ref={closeRef}>
              <FiX aria-hidden="true" />
            </button>
          </div>
          <div className="cs-actions">
            {actions.map(({ key, label, href, Icon }) => href ? (
              <a key={key} href={href} className={`cs-action cs-action--${key}`}
                target={key === "call" ? undefined : "_blank"}
                rel={key === "call" ? undefined : "noopener noreferrer"} aria-label={label}>
                <Icon aria-hidden="true" className="cs-action__icon" />
                <span className="cs-action__label">{label}</span>
              </a>
            ) : (
              <button key={key} type="button" disabled className={`cs-action cs-action--${key}`}
                aria-label={`${label} unavailable`} title={loading ? "Loading" : "Not configured or unavailable"}>
                <Icon aria-hidden="true" className="cs-action__icon" />
                <span className="cs-action__label">{label}</span>
              </button>
            ))}
          </div>
          {message && <p className="cs-empty" role="status">{message}</p>}
          {!loading && (contactError || error) && <button type="button" className="cs-retry" onClick={reload}>Retry contact options</button>}
        </div>
      </div>
    </ViewportPortal>
  );
}
