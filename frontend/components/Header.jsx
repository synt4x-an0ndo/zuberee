"use client";

import { useState } from "react";
import {
  MailIcon,
  FacebookIcon,
  TwitterIcon,
  InstagramIcon,
  GlobeIcon,
  PhoneIcon,
  SearchIcon,
  CartIcon,
  MenuIcon,
  CloseIcon,
} from "./Icons";
import { categories, navLinks } from "../lib/data";

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("category");
  const [catOpen, setCatOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);

  return (
    <div className="position-relative">
      <header className="header">
        {/* ---------------- top bar ---------------- */}
        <div className="header__top">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-6 col-md-6 d-none d-xl-block">
                <div className="header__top__left">
                  <ul className="mb-0">
                    <li>
                     <img
  src="https://cdn-icons-png.flaticon.com/512/1237/1237439.png"
  alt="Mail"
  className="me-2"
  width={14}
  height={14}
/>
                      <a href="mailto:support@zuebree.com">
                       support@zuebree.com
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="col-lg-6 col-md-6 d-none d-xl-block">
                <div className="header__top__right d-flex justify-content-end align-items-center">
                  <div className="header__top__right__social me-4">
                  <a href="https://www.facebook.com/zuberee2025" target="_blank" rel="noopener noreferrer">
                    <img
  src="https://thumb.wikimedia.org/wikipedia/en/thumb/0/04/Facebook_f_logo_%282021%29.svg/960px-Facebook_f_logo_%282021%29.svg.png"
  alt="Facebook"
  className="me-2"
  width={14}
  height={14}
  style={{ filter: "grayscale(100%)" }}
/>
  </a>                  
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      <img
  src="https://upload.wikimedia.org/wikipedia/commons/9/95/Twitter_new_X_logo.png"
  alt="Mail"
  className="me-2"
  width={14}
  height={14}
  style={{ filter: "grayscale(100%)" }}
/>
                    </a>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      <img
  src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png"
  alt="Mail"
  className="me-2"
  width={14}
  height={14}
  style={{ filter: "grayscale(100%)" }}
/>
                    </a>
                    <a href="#" target="_blank" rel="noopener noreferrer">
                     <img
  src="https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png"
  alt="Mail"
  className="me-2"
  width={14}
  height={14}
  style={{ filter: "grayscale(100%)" }}
/>
                    </a>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- main header ---------------- */}
        <div className="container">
          <div className="row align-items-center py-2">
            {/* mobile bar */}
            <div className="d-flex d-xl-none justify-content-between align-items-center w-100 px-3 mt-3">
              <button
                className="mobile_humberger_icon"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </button>

              {/* slide-in drawer */}
              {drawerOpen && (
                <div
                  className="mobile-drawer__overlay d-md-none"
                  onClick={() => setDrawerOpen(false)}
                  aria-hidden
                />
              )}
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                className={`mobile-drawer d-md-none ${drawerOpen ? "open" : ""}`}
              >
                <button
                  className="mobile-drawer__close"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                >
                  <CloseIcon />
                </button>
                <div className="mobile-drawer__tabs">
                  <button
                    type="button"
                    className={drawerTab === "category" ? "active" : ""}
                    onClick={() => setDrawerTab("category")}
                  >
                    category
                  </button>
                  <button
                    type="button"
                    className={drawerTab === "menu" ? "active" : ""}
                    onClick={() => setDrawerTab("menu")}
                  >
                    menu
                  </button>
                </div>
                <div className="p-3">
                  {drawerTab === "category" ? (
                    <ul className="list-unstyled mb-0">
                      {categories.map((c) => (
                        <li className="py-2 border-bottom" key={c}>
                          <a href="#" className="text-decoration-none text-dark small">
                            {c}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="list-unstyled mb-0">
                      {navLinks.map((l) => (
                        <li className="py-2 border-bottom" key={l.label}>
                          <a href={l.href} className="text-decoration-none text-dark small">
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mobile_logo">
                <a  href="/">
                  <img 
                    className="site-logo site-logo--mobile"
                    src="/zuberee-logo.png"
                    alt="Zuberee"
                  />
                </a>
              </div>

              <div className="dropdown pb-1">
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 d-flex align-items-center"
                  aria-label="Language and currency"
                >
                  <GlobeIcon width={16} height={16} />
                </button>
              </div>
            </div>

            {/* mobile search */}
            <div className="d-flex d-xl-none w-100 my-3 px-3">
              <div className="position-relative w-100 mobile-search">
                <div className="input-group shadow-sm w-100">
                  <span className="input-group-text border-end-0">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    className="form-control border-start-0"
                    placeholder="Search Products By Name"
                    aria-label="Search products"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {/* desktop: logo / menu / cart */}
            <div className="col-lg-3 d-none d-xl-block">
              <div className="header__logo py-2">
                <a href="/">
                  <img
                    className="site-logo site-logo--desktop"
                    src="/zuberee-logo.png"
                    alt="Zuberee"
                  />
                </a>
              </div>
            </div>
            <div className="col-lg-6 d-none d-xl-block">
              <nav className="header__menu">
                <ul className="d-flex justify-content-center align-items-center mb-0 nav-list">
                  {navLinks.map((l) => (
                    <li className="mx-3" key={l.label}>
                      <a
                        className={`desktop-nav-link ${l.active ? "activated-nav" : ""}`}
                        href={l.href}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="col-lg-3 d-none d-xl-block">
              <div className="d-flex align-items-center justify-content-end">
                <button
                  className="cart-icon-btn me-3"
                  aria-label="Open cart"
                >
                  <CartIcon />
                </button>
                <div className="header__cart__price d-none d-lg-block">
                  <span className="fw-bold">Cart Total: 0 Tk</span>
                </div>
              </div>
            </div>
          </div>

          {/* categories + search strip */}
          <div className="row d-none d-xl-flex position-relative align-items-center">
            <div className="col-lg-3 mb-lg-4">
              <div className="hero__categories">
                <button
                  type="button"
                  className="hero__categories__all"
                  onClick={() => setCatOpen((v) => !v)}
                  aria-expanded={catOpen}
                >
                  <MenuIcon className="hero_category_icon" />
                  <span>All Categories</span>
                </button>
                <ul className={catOpen ? "open" : ""}>
                  {categories.map((c) => (
                    <li key={c}>
                      <a href="#">{c}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-lg-9">
              <div className="hero__search d-flex align-items-center justify-content-between hero_search__inner">
                <div className="hero__search__form">
                  <div className="d-flex">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="What do you need?"
                      aria-label="Search products"
                      autoComplete="off"
                      style={{ height: "3rem" }}
                    />
                    <button type="button" className="site-btn">
                      SEARCH
                    </button>
                  </div>
                </div>
                <div className="hero__search__phone">
                  <div className="hero__search__phone__icon">
                    <PhoneIcon width={20} height={20} />
                  </div>
                  <div className="hero__search__phone__text">
                    <h5>+880 1614 477 721</h5>
                    <span>support 24/7 time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
