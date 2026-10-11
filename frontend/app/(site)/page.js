"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { api, asBoolean, imgUrl, unwrapList } from "@/lib/api";
import Loader from "@/components/Loader";

/** API-driven storefront homepage. No sample inventory is rendered on failure. */
export default function HomePage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [activeBanner, setActiveBanner] = useState(0);

  const loadBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      const response = await api.get("api/banners", { auth: false });
      const list = unwrapList(response, ["banners"]);
      setBanners(list.filter((banner) =>
        asBoolean(banner?.is_active ?? banner?.isActive, true) && imgUrl(banner?.image)
      ));
      setActiveBanner(0);
    } catch {
      setBanners([]);
    } finally {
      setBannersLoading(false);
    }
  }, []);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [categoriesResponse, productsResponse] = await Promise.all([
        api.get("api/categories", { auth: false }),
        api.get("api/products", { auth: false }),
      ]);
      const categoryTree = unwrapList(categoriesResponse, ["categories"]);
      const categories = flattenCategories(categoryTree).filter((category) => {
        const homepageFlag = category.home_category ?? category.showOnHomepage;
        return homepageFlag == null || asBoolean(homepageFlag, false);
      });
      const products = unwrapList(productsResponse, ["products"]);
      const grouped = categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        products: products.filter((product) =>
          (Array.isArray(product.category) ? product.category : [product.category])
            .filter(Boolean)
            .some((item) => String(item.id) === String(category.id))
        ).slice(0, 8),
      })).filter((slot) => slot.products.length > 0);
      setSlots(grouped);
    } catch (error) {
      setSlots([]);
      setLoadError(error?.message || "Store collections could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBanners();
    loadSlots();
  }, [loadBanners, loadSlots]);

  useEffect(() => {
    const refreshBanners = (event) => {
      if (event.key === "banner-sync") loadBanners();
    };
    window.addEventListener("storage", refreshBanners);
    return () => window.removeEventListener("storage", refreshBanners);
  }, [loadBanners]);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveBanner((index) => (index + 1) % banners.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const removeBrokenBanner = (banner) => {
    setBanners((current) => current.filter((item) => item.id !== banner.id));
    setActiveBanner(0);
  };

  return (
    <>
      {bannersLoading ? (
        <div className="container hero-banner-loading" aria-hidden="true">
          <div className="hero-banner-loading__shape" />
        </div>
      ) : banners.length > 0 ? (
        <section className="container hero_banner" aria-label="Featured collections">
          <div id="heroSlider" className="carousel slide">
            <div className="carousel-inner">
              {banners.map((banner, index) => (
                <div
                  key={banner.id ?? index}
                  className={`carousel-item ${index === activeBanner ? "active" : ""}`}
                  aria-hidden={index !== activeBanner}
                >
                  <BannerSlide
                    banner={banner}
                    priority={index === 0}
                    onMissing={() => removeBrokenBanner(banner)}
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
                </button>
                <button
                  className="carousel-control-next"
                  type="button"
                  aria-label="Next banner"
                  onClick={() => setActiveBanner((activeBanner + 1) % banners.length)}
                >
                  <span className="carousel-control-next-icon" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {loading ? (
        <Loader />
      ) : loadError ? (
        <div className="container py-5">
          <div className="home-empty-state text-center">
            <h1 className="h4">The storefront is getting ready</h1>
            <p className="text-muted">{loadError}</p>
            <button type="button" className="btn btn-outline-secondary" onClick={loadSlots}>
              Try again
            </button>
          </div>
        </div>
      ) : slots.length > 0 ? (
        <div className="container home-collections py-3 py-lg-4">
          {slots.map((slot) => (
            <section className="home-collection" key={slot.id} aria-labelledby={`collection-${slot.id}`}>
              <div className="home-collection-heading">
                <div>
                  <p className="shop-eyebrow mb-1">Discover the collection</p>
                  <h2 id={`collection-${slot.id}`} className="featured-heading">{slot.name}</h2>
                </div>
                <Link href={`/${slot.slug || slot.id}`} className="home-view-all">
                  View collection <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="row mx-0">
                {slot.products.map((product) => (
                  <div key={product.id} className="col-6 col-md-4 col-lg-3 px-1 px-md-2 mb-3">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="container py-5">
          <div className="home-empty-state text-center">
            <h1 className="h4">A new collection is on its way</h1>
            <p className="text-muted">There are no featured products to show right now.</p>
            <Link href="/shop" className="btn btn-grad px-4">Explore the shop</Link>
          </div>
        </div>
      )}
    </>
  );
}

function BannerSlide({ banner, priority, onMissing }) {
  const image = imgUrl(banner.image);
  if (!image) return null;
  const content = (
    <img
      className="hero_banner_img"
      src={image}
      alt={banner.title || "Featured collection"}
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={onMissing}
    />
  );
  const destination = String(banner.link || "").trim();
  if (destination.startsWith("/") && !destination.startsWith("//")) {
    return <Link href={destination}>{content}</Link>;
  }
  if (/^https?:\/\//i.test(destination)) {
    return <a href={destination} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return content;
}

function flattenCategories(categories) {
  const output = [];
  const visit = (items) => {
    (items || []).forEach((item) => {
      output.push(item);
      visit(item.all_children || item.children);
    });
  };
  visit(categories);
  return output;
}
