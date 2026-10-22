import Link from "next/link";
import { FaFacebookF, FaInstagram, FaPinterestP, FaTwitter, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import Img from "@/components/Img";
import { useSite } from "@/context/SiteContext";

/** Footer content comes entirely from admin-managed settings; empty fields are simply omitted. */

/** Payment-brand artwork stored locally so the footer never relies on an external image host. */
const PAY_METHODS = [
  { label: "Visa", logo: "/payment-logos/visa.png" },
  { label: "Mastercard", logo: "/payment-logos/mastercard.png" },
  { label: "bKash", logo: "/payment-logos/bkash.png" },
  { label: "Nagad", logo: "/payment-logos/nagad.png" },
  { label: "Rocket", logo: "/payment-logos/rocket.png" },
  { label: "Upay", logo: "/payment-logos/upay.png" },
];
export default function Footer({ siteName, company, social, roots }) {
  const { logoSizes } = useSite();
  const socials = [
    { href: social.facebook, label: "Facebook", Icon: FaFacebookF },
    { href: social.instagram, label: "Instagram", Icon: FaInstagram },
    { href: social.youtube, label: "YouTube", Icon: FaYoutube },
    { href: social.twitter, label: "X / Twitter", Icon: FaTwitter },
    { href: social.pinterest, label: "Pinterest", Icon: FaPinterestP },
    {
      href: social.whatsapp ? `https://wa.me/${social.whatsapp.replace(/\D/g, "")}` : "",
      label: "WhatsApp",
      Icon: FaWhatsapp,
    },
  ].filter((item) => item.href);

  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <Link href="/" className="brand footer-brand" style={{ color: "#fff" }}>
          {company.logo ? (
            <Img src={company.logo} alt={siteName || "Logo"} width={logoSizes.footer.width} height={logoSizes.footer.height} style={{ width: logoSizes.footer.width, height: logoSizes.footer.height, objectFit: "contain" }} />
          ) : (
            <span className="brand-name">{siteName}</span>
          )}
        </Link>

        <div className="footer-grid">
          <div className="footer-box">
            {company.description && (
              <p style={{ marginTop: 0, maxWidth: "36ch" }}>{company.description}</p>
            )}
            {socials.length > 0 && (
              <div className="social-row">
                {socials.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                    <Icon aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="footer-box">
            <h3>Main Menu</h3>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/shop">Shop</Link></li>
              <li><Link href="/about_us">About Us</Link></li>
            </ul>
          </div>

          <div className="footer-box">
            <h3>Useful Link</h3>
            <ul>
              <li><Link href="/about_us">About Us</Link></li>
              <li><Link href="/privacy_policy">Privacy Policy</Link></li>
              <li><Link href="/return_policy">Refund and Returns Policy</Link></li>
              <li><Link href="/track-order">Track an Order</Link></li>
              <li><Link href="/size-guide">Size Guide</Link></li>
            </ul>
          </div>

          <div className="footer-box">
            <h3>Contact</h3>
            <ul className="footer-contact">
              {company.address && (
                <li><FiMapPin aria-hidden="true" /><span>{company.address}</span></li>
              )}
              {company.phone && (
                <li><FiPhone aria-hidden="true" /><a href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a></li>
              )}
              {company.email && (
                <li><FiMail aria-hidden="true" /><a href={`mailto:${company.email}`}>{company.email}</a></li>
              )}
            </ul>
            <h3 style={{ marginTop: "1.5rem" }}>Pay With</h3>
            <div className="pay-with" aria-label="Accepted payment methods">
              {PAY_METHODS.map((method) => (
                <span key={method.label} className="pay-logo" title={method.label}>
                  <Img src={method.logo} alt={method.label} width={104} height={40} className="pay-logo-image" />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} {siteName || "All Rights Reserved"} All Rights Reserved</span>
          <span> | </span>
         <span>
  Developed By{" "}
  <a
    href="https://therawbros.pages.dev"
    target="_blank"
    rel="noopener noreferrer"
    className="footer-developer-link"
  >
    The Raw Bros
  </a>
</span>
        </div>
      </div>
    </footer>
  );
}
