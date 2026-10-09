"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { api, asBoolean, imgUrl, unwrapList } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

import "@/styles/css/09b8a269a4a7b1a3.css";

/**
 * Home page.
 *  - Hero banner:   GET api/banners
 *  - Homepage categories/products: GET api/categories and GET api/products
 */
export default function HomePage() {
  const [slots, setSlots] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerRequest = useRef(null);

  /* ---- hero banners (API-driven) ---- */
  const loadBanners = useCallback(async () => {
    if (bannerRequest.current) return bannerRequest.current;
    bannerRequest.current = (async () => {
    try {
      const r = await api.get("api/banners", { auth: false });
      const list = unwrapList(r, ["banners"]);
      const images = list.filter((banner) => banner?.image && asBoolean(banner.is_active, true));
      setBanners(images);
      setActiveBanner(0);
    } catch {
      setBanners([]);
    } finally {
      setBannersLoading(false);
    }
    })();
    try {
      return await bannerRequest.current;
    } finally {
      bannerRequest.current = null;
    }
  }, []);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  useEffect(() => {
    const refreshFromAdmin = (event) => {
      if (event.key === "banner-sync") loadBanners();
    };
    window.addEventListener("storage", refreshFromAdmin);
    return () => window.removeEventListener("storage", refreshFromAdmin);
  }, [loadBanners]);

  useEffect(() => {
    if (banners.length < 2) return undefined;

    const timer = window.setInterval(() => {
      setActiveBanner((index) => (index + 1) % banners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  /* ---- home slots ---- */
  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const [categoriesResponse, productsResponse] = await Promise.all([
        api.get("api/categories", { auth: false }),
        api.get("api/products", { auth: false }),
      ]);
      const categories = unwrapList(categoriesResponse, ["categories"]);
      const products = unwrapList(productsResponse, ["products"]);
      const grouped = categories
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          products: products.filter((product) =>
            (product.category || []).some((item) => item.id === category.id)
          ),
        }))
        .filter((slot) => slot.products.length > 0);
      setSlots(grouped);
      setHasMore(false);
    } catch (e) {
      notify.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const visible = slots.filter((s) => (s.products || []).length > 0);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      {bannersLoading ? (
        <Loader />
      ) : banners.length > 0 ? (
        <section className="container hero_banner" aria-label="Site banner">
          <div id="heroSlider" className="carousel slide">
            <div className="carousel-inner">
              {banners.map((b, i) => (
                <div
                  key={b.id ?? i}
                  className={`carousel-item ${i === activeBanner ? "active" : ""}`}
                >
                  <BannerSlide
                    banner={b}
                    priority={i === 0}
                    onMissing={loadBanners}
                  />
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <>
                <button
                  className="carousel-control-prev"
                  type="button"
                  aria-label="Previous banner"
                  onClick={() => setActiveBanner((activeBanner - 1 + banners.length) % banners.length)}
                >
                  <span className="carousel-control-prev-icon" aria-hidden="true" />
                  <span className="visually-hidden">Previous</span>
                </button>
                <button
                  className="carousel-control-next"
                  type="button"
                  aria-label="Next banner"
                  onClick={() => setActiveBanner((activeBanner + 1) % banners.length)}
                >
                  <span className="carousel-control-next-icon" aria-hidden="true" />
                  <span className="visually-hidden">Next</span>
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {/* ---------------- CATEGORY SLOTS ---------------- */}
      {loading ? (
        <Loader />
      ) : visible.length ? (
        <div className="container mb-3 mb-md-5 mt-0 py-2">
          <div className="row position-relative">
            {visible.map((slot) => {
              const products = slot.products || [];
              return (
                <div key={slot.id} className="col-12">
                  <div className="col-12 d-flex justify-content-between align-items-center position-relative home_page_card_header mb-2">
                    <div className="slot-name">
                      <small className="featured-heading">{slot.name}</small>
                    </div>
                    <Link
                      href={`/frontEnd/${slot.slug || slot.id}`}
                      className="btn btn-outline-dark btn-sm fw-semibold"
                    >
                      View All
                    </Link>
                  </div>
                  <div className="row mx-0 mb-4">
                    {products.map((p, i) => (
                      <div
                        key={p.id || i}
                        className="col-6 col-md-4 col-lg-3 px-1 px-md-2 mb-3"
                      >
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div className="col-12 text-center my-4">
                <button
                  className="slot-loadmore-btn"
                  onClick={loadSlots}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      />
                      Loading...
                    </>
                  ) : (
                    <div>Load More</div>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center my-5">No categories found</div>
      )}
    </>
  );
}

function BannerSlide({ banner, priority, onMissing }) {
  const imageUrl = imgUrl(banner.image);
  const cacheKey = banner.updated_at || banner.created_at || banner.id;
  const image = (
    <img
      className="hero_banner_img d-block w-100"
      src={imageUrl ? `${imageUrl}?v=${encodeURIComponent(cacheKey)}` : undefined}
      alt={banner.title || ""}
      fetchPriority={priority ? "high" : "auto"}
      onError={onMissing}
    />
  );

  return banner.link ? (
    <a href={banner.link} target="_blank" rel="noopener noreferrer">
      {image}
    </a>
  ) : (
    image
  );
}
