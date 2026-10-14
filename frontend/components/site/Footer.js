import Link from "next/link";
import { FaFacebookF, FaInstagram, FaPinterestP, FaTwitter, FaWhatsapp, FaYoutube } from "react-icons/fa";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import Img from "@/components/Img";

/** Footer content comes entirely from admin-managed settings; empty fields are simply omitted. */
export default function Footer({ siteName, company, social, roots }) {
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
        <div className="footer-grid">
          <div>
            <Link href="/" className="brand" style={{ color: "#fff" }}>
              {company.logo ? (
                <Img src={company.logo} alt={siteName || "Logo"} width={180} height={44} />
              ) : (
                <span className="brand-name">{siteName}</span>
              )}
            </Link>
            {company.description && (
              <p style={{ marginTop: "1rem", maxWidth: "36ch" }}>{company.description}</p>
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

          <div>
            <h3>Shop</h3>
            <ul>
              <li><Link href="/shop">All products</Link></li>
              {roots.slice(0, 6).map((category) => (
                <li key={category.id}>
                  <Link href={`/${category.slug}`}>{category.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Account</h3>
            <ul>
              <li><Link href="/user">My account</Link></li>
              <li><Link href="/user/orders">Order history</Link></li>
              <li><Link href="/cart">Cart</Link></li>
              <li><Link href="/login">Sign in</Link></li>
            </ul>
          </div>

          <div>
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
            <ul style={{ marginTop: "1.25rem" }}>
              <li><Link href="/privacy_policy">Privacy policy</Link></li>
              <li><Link href="/return_policy">Return policy</Link></li>
              <li><Link href="/size-guide">Size guide</Link></li>
              <li><Link href="/about_us">About us</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} {siteName || "All rights reserved"}</span>
          <span>Cash on delivery</span>
        </div>
      </div>
    </footer>
  );
}
