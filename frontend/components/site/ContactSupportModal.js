"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FaFacebookMessenger, FaWhatsapp } from "react-icons/fa";
import { FiPhone, FiX } from "react-icons/fi";
import ViewportPortal from "@/components/ViewportPortal";
import { useSite } from "@/context/SiteContext";

/**
 * Contact Support popup, opened from the mobile bottom navigation.
 *
 * Every action is built from configuration that already exists in the project —
 * nothing is invented here. A button is only rendered when its value is present:
 *
 *   Call      <- SiteContext.company.phone      (Admin -> Footer Settings -> Contact)
 *   WhatsApp  <- SiteContext.social.whatsapp    (Admin -> Settings -> Social links)
 *   Messenger <- SiteContext.social.messenger   (Admin -> Settings -> Social links)
 *
 * A button renders only when its value is configured, so nothing is invented.
 * Keep the animation durations in sync with the keyframes in globals.css.
 */

const OPEN_MS = 300;
const CLOSE_MS = 200;

const telHref = (raw) => {
  const value = String(raw || "").replace(/[^\d+]/g, "");
  return value ? `tel:${value}` : "";
};

const waHref = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
};

export default function ContactSupportModal({ open, onClose }) {
  const { company, social } = useSite();
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const closeRef = useRef(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onClose?.();
      return;
    }
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setClosing(false);
      onClose?.();
    }, CLOSE_MS);
  }, [closing, onClose]);

  // Escape to dismiss + lock background scrolling, matching components/ui.js Modal.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, requestClose]);

  // Clear a pending close if we unmount mid-animation.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Move focus into the dialog so Escape/screen readers start inside it.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const actions = [
    {
      key: "messenger",
      label: "Messenger",
      href: String(social?.messenger || "").trim(),
      className: "cs-action--messenger",
      Icon: FaFacebookMessenger,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: waHref(social?.whatsapp),
      className: "cs-action--whatsapp",
      Icon: FaWhatsapp,
    },
    {
      key: "call",
      label: "Call",
      href: telHref(company?.phone),
      className: "cs-action--call",
      Icon: FiPhone,
    },
  ].filter((action) => action.href);

  return (
    <ViewportPortal>
      <div
        className={`cs-overlay${closing ? " is-closing" : ""}`}
        onMouseDown={(event) => {
          // Dismiss only when the press starts on the backdrop itself.
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <div
          className={`cs-card${closing ? " is-closing" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cs-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="cs-head">
            <h2 className="cs-title" id="cs-title">
              Contact Support
            </h2>
            <button
              type="button"
              className="cs-close"
              onClick={requestClose}
              aria-label="Close contact support"
              ref={closeRef}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>

          {actions.length > 0 ? (
            <div className="cs-actions">
              {actions.map(({ key, label, href, className, Icon }) => (
                <a
                  key={key}
                  href={href}
                  className={`cs-action ${className}`}
                  target={key === "call" ? undefined : "_blank"}
                  rel={key === "call" ? undefined : "noopener noreferrer"}
                >
                  <Icon aria-hidden="true" className="cs-action__icon" />
                  <span className="cs-action__label">{label}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="cs-empty">
              No contact details are configured yet. Add a phone number in the admin
              settings to enable these options.
            </p>
          )}
        </div>
      </div>
    </ViewportPortal>
  );
}
