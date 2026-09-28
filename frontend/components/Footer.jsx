import {
  ChevronRightIcon,
  FacebookIcon,
  InstagramIcon,
  GlobeIcon,
  WhatsappIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
} from "./Icons";
import { footerBoxes } from "../lib/data";

export default function Footer() {
  return (
    <footer className="footer_bg position-relative overflow-hidden pt-5">
      <div className="container py-4">
        <div className="row g-4">
          {/* brand / contact card */}
          <div className="col-lg-4 col-md-6">
            <div className="footer-box rounded-4 p-4 h-100">
              <div className="mb-3">
                <a href="/">
                  <img
                    className="site-logo site-logo--footer footer-brand-logo"
                    src="/zuberee-logo.png"
                    alt="Zuberee"
                  />
                </a>
              </div>
              <p className="text-white mb-4 small">
                Welcome to Eyarafashion.com “We Believe In Satisfaction” defines our
                commitment to excellence and unforgettable products.
              </p>
              <div className="d-flex gap-2 mb-4 flex-wrap">
                <a href="#" className="footer-social-btn btn-sm rounded-circle p-2" aria-label="Facebook">
                  <FacebookIcon />
                </a>
                <a href="#" className="footer-social-btn btn-sm rounded-circle p-2" aria-label="Instagram">
                  <InstagramIcon />
                </a>
                <a href="#" className="footer-social-btn btn-sm rounded-circle p-2" aria-label="Website">
                  <GlobeIcon />
                </a>
                <a href="#" className="footer-social-btn btn-sm rounded-circle p-2" aria-label="WhatsApp">
                  <WhatsappIcon />
                </a>
              </div>
              <div className="contact-box rounded-3 p-3">
                <h6 className="text-white mb-3 fw-bold">Contact Info</h6>
                <div className="d-flex align-items-center mb-2">
                  <PhoneIcon className="text-white me-2" />
                  <a href="tel:01614477721" className="text-white small text-decoration-none">
                    01614477721
                  </a>
                </div>
                <div className="d-flex align-items-center mb-2">
                  <MailIcon className="text-white me-2" />
                  <a
                    href="mailto:support@eyarafashion.com"
                    className="text-white small text-decoration-none"
                  >
                    support@eyarafashion.com
                  </a>
                </div>
                <div className="d-flex align-items-start">
                  <MapPinIcon className="text-white me-2 mt-1" />
                  <span className="text-white small">Mirpur Dhaka - 1216</span>
                </div>
              </div>
            </div>
          </div>

          {/* link columns */}
          <div className="col-lg-8">
            <div className="row g-4">
              {footerBoxes.map((box) => (
                <div className="col-6 col-md-3" key={box.heading}>
                  <div className="footer-box rounded-4 p-4 h-100">
                    <h6
                      className="text-white mb-3 fw-bold text-uppercase small"
                      style={{ letterSpacing: 1 }}
                    >
                      {box.heading}
                    </h6>
                    <ul className="list-unstyled mb-0">
                      {box.links.map((link) => (
                        <li className="mb-2" key={link.label}>
                          <a
                            className="text-white d-flex align-items-center text-decoration-none link-hover"
                            href={link.href}
                          >
                            <ChevronRightIcon className="me-2" />
                            <span className="small text-white">{link.label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <hr className="my-4 border-white border-opacity-25" />

        <div className="row align-items-center py-3">
          <div className="col-12 mb-5 mb-md-3 mb-md-0 text-center text-md-center">
            <p className="text-white mb-0 small text-center">
              © Eyara Fashion. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
