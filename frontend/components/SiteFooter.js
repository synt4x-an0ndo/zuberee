"use client";

import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
  FaPhone as FaPhoneAlt,
  FaEnvelope,
  FaLocationDot,
  FaChevronRight,
} from "react-icons/fa6";
import { useSite } from "@/context/SiteContext";

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return digits;
  return digits.startsWith("0") ? `88${digits}` : `880${digits}`;
}

/**
 * Footer - all company information comes from the API:
 *  - description / phone / email / address -> GET api/footer-settings
 *  - social urls / whatsapp                -> GET api/social-links-first
 */
export default function SiteFooter() {
  const { company, social } = useSite();

  const whatsapp = normalizeWhatsapp(social?.whatsapp_number);
  const socials = [
    { href: safeExternalUrl(social?.facebook), icon: <FaFacebookF /> },
    { href: safeExternalUrl(social?.instagram), icon: <FaInstagram /> },
    { href: safeExternalUrl(social?.youtube), icon: <FaYoutube /> },
    whatsapp ? { href: `https://wa.me/${whatsapp}`, icon: <FaWhatsapp /> } : null,
  ].filter((item) => item?.href);
  const columns = [
    {
      id: "shop",
      title: "shop",
      links: [
        { label: "Shop all", href: "/shop" },
        { label: "Size guide", href: "/size-guide" },
        { label: "My account", href: "/user" },
      ],
    },
    {
      id: "support",
      title: "support",
      links: [
        { label: "Privacy Policy", href: "/privacy_policy" },
        { label: "Returns & Exchanges", href: "/return_policy" },
        { label: "Size Guide", href: "/size-guide" },
      ],
    },
    {
      id: "company",
      title: "company",
      links: [
        { label: "About us", href: "/about_us" },
      ],
    },
  ];

  return (
    <footer className="footer_bg position-relative overflow-hidden pt-5">
      <div className="container py-4">
        <div className="row g-4">
          <div className="col-lg-4 col-md-6">
            <div className="footer-box rounded-4 p-4 h-100">
              {company.description ? (
                <p className="text-white mb-4 small">{company.description}</p>
              ) : null}
              <div className="d-flex gap-2 mb-4 flex-wrap">
                {socials.map((s, i) => (
                  <a
                    key={i}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-btn btn-sm rounded-circle p-2"
                  >
                    <span className="text-white">{s.icon}</span>
                  </a>
                ))}
              </div>
              {company.phone || company.email || company.address ? <div className="contact-box rounded-3 p-3">
                <h6 className="text-white mb-3 fw-bold">Contact Info</h6>
                {company.phone ? <div className="d-flex align-items-center mb-2">
                  <FaPhoneAlt className="text-white me-2 fs-6" />
                  <a
                    href={company.phone ? `tel:${company.phone.replace(/\s/g, "")}` : "#"}
                    className="text-white small text-decoration-none"
                  >
                    {company.phone}
                  </a>
                </div> : null}
                {company.email ? <div className="d-flex align-items-center mb-2">
                  <FaEnvelope className="text-white me-2 fs-6" />
                  <a
                    href={company.email ? `mailto:${company.email}` : "#"}
                    className="text-white small text-decoration-none"
                  >
                    {company.email}
                  </a>
                </div> : null}
                {company.address ? <div className="d-flex align-items-start">
                  <FaLocationDot className="text-white me-2 mt-1 fs-6" />
                  <span className="text-white small">
                    {company.address}
                  </span>
                </div> : null}
              </div> : null}
            </div>
          </div>

          <div className="col-lg-8">
            <div className="row g-4">
              {columns.map((col) => (
                <div key={col.id} id={col.id} className="col-6 col-md-3">
                  <div className="footer-box rounded-4 p-4 h-100">
                    <h6
                      className="text-white mb-3 fw-bold text-uppercase small"
                      style={{ letterSpacing: "1px" }}
                    >
                      {col.title}
                    </h6>
                    <ul className="list-unstyled mb-0">
                      {col.links.map((l) => (
                        <li key={l.label} className="mb-2">
                          <Link
                            href={l.href}
                            className="text-white d-flex align-items-center text-decoration-none link-hover"
                          >
                            <FaChevronRight
                              className="me-2 chevron-icon"
                              style={{ fontSize: 10 }}
                            />
                            <span className="small text-white">{l.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-4 pt-3 border-top border-white border-opacity-25">
          <p className="mb-0 small text-white">
            {company.name ? <>© <span className="fw-semibold">{company.name}</span>. </> : null}
            All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
