/* Minimal inline SVG icon set.
   The real site uses icon fonts + inline SVGs; this clone keeps every icon as a
   self-contained inline SVG so the layout renders with zero external assets. */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export function MailIcon(p) {
  return (
    <svg {...base} {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m3 6 9 6 9-6" />
    </svg>
  );
}

export function FacebookIcon(p) {
  return (
    <svg {...base} {...p}>
      <path d="M15 3h-3a5 5 0 0 0-5 5v3H4v4h3v6h4v-6h3l1-4h-4V8a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function TwitterIcon(p) {
  return (
    <svg {...base} {...p}>
      <path d="M22 5.9c-.7.3-1.5.5-2.3.6a4 4 0 0 0 1.8-2.2c-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.9 3.6A11.3 11.3 0 0 1 3.8 4.7a4 4 0 0 0 1.2 5.3c-.6 0-1.2-.2-1.7-.5a4 4 0 0 0 3.2 4 4 4 0 0 1-1.8.1 4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18.1a11.3 11.3 0 0 0 17.4-10.1c.8-.6 1.5-1.3 2-2.1z" />
    </svg>
  );
}

export function InstagramIcon(p) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function WhatsappIcon(p) {
  return (
    <svg {...base} {...p}>
      <path d="M21 12a9 9 0 0 1-13.3 7.9L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 1-.6.6-1l-.8-.8-1.3.6-1.9-1.9.6-1.3-.8-.8c-.4-.4-1-.1-.9.5z" />
    </svg>
  );
}

export function GlobeIcon(p) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18z" />
    </svg>
  );
}

export function ChevronDownIcon(p) {
  return (
    <svg {...base} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon(p) {
  return (
    <svg {...base} {...p} width={14} height={14} className={`chevron-icon ${p.className || ""}`}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function PhoneIcon(p) {
  return (
    <svg {...base} {...p}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function MapPinIcon(p) {
  return (
    <svg {...base} {...p}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function SearchIcon(p) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CartIcon(p) {
  return (
    <svg {...base} {...p} width={22} height={22}>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}

export function UserIcon(p) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function MenuIcon(p) {
  return (
    <svg {...base} {...p} width={24} height={24}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function CloseIcon(p) {
  return (
    <svg {...base} {...p} width={22} height={22}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function HomeIcon(p) {
  return (
    <svg {...base} {...p} width={20} height={20}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function ShopIcon(p) {
  return (
    <svg {...base} {...p} width={20} height={20}>
      <path d="M4 8h16l-1 12H5z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

export function GridIcon(p) {
  return (
    <svg {...base} {...p} width={20} height={20}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
