"use client";

import { HomeIcon, ShopIcon, GridIcon, WhatsappIcon, CartIcon } from "./Icons";

export default function MobileBottomNav() {
  return (
    <div className="mobile-bottom-nav d-md-none">
      <div className="container-fluid h-100 px-0">
        <div className="row h-100 align-items-center justify-content-around text-center mx-0 gx-1">
          <div className="col px-1">
            <a className="text-decoration-none" href="/">
              <div className="d-flex flex-column align-items-center justify-content-center">
                <HomeIcon />
                <small className="text-dark mt-1">Home</small>
              </div>
            </a>
          </div>

          <div className="col px-1">
            <a className="text-decoration-none" href="/frontEnd/shop">
              <div className="d-flex flex-column align-items-center justify-content-center">
                <ShopIcon />
                <small className="text-dark mt-1">Shop</small>
              </div>
            </a>
          </div>

          <div className="col px-1">
            <button type="button" className="border-0 bg-transparent w-100 p-0">
              <div className="d-flex flex-column align-items-center justify-content-center">
                <GridIcon />
                <small className="text-dark mt-1">Category</small>
              </div>
            </button>
          </div>

          <div className="col px-1">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none d-block"
            >
              <div className="d-flex flex-column align-items-center justify-content-center">
                <WhatsappIcon />
                <small className="text-success mt-1">WhatsApp</small>
              </div>
            </a>
          </div>

          <div className="col px-1">
            <button
              type="button"
              className="border-0 bg-transparent w-100 p-0 position-relative"
            >
              <div className="d-flex flex-column align-items-center justify-content-center">
                <div className="position-relative">
                  <CartIcon />
                </div>
                <small className="text-dark mt-1">Cart</small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
