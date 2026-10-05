"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { api, imgUrl } from "@/lib/api";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

import "@/styles/css/09b8a269a4a7b1a3.css";

/**
 * Home page.
 *  - Hero banner:   GET api/banners
 *  - Category slots: GET api/product-slots_index/frontEndIndex?page=N
 *    (each slot = category name + slug + products + has_more for "Load More")
 */
export default function HomePage() {
  const [slots, setSlots] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);

  /* ---- hero banners (API-driven) ---- */
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("api/banners");
        const list = Array.isArray(r?.data) ? r.data : [];
        const images = list.filter((banner) => banner?.image);
        setBanners(images);
      } catch {
        setBanners([]);
      } finally {
        setBannersLoading(false);
      }
    })();
  }, []);

  /* ---- home slots ---- */
  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("api/product-slots_index/frontEndIndex?page=1");
      setSlots(Array.isArray(r?.data) ? r.data : []);
      setHasMore(!!r?.has_more);
      setPage(1);
    } catch (e) {
      notify.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await api.get(`api/product-slots_index/frontEndIndex?page=${next}`);
      const list = Array.isArray(r?.data) ? r.data : [];
      if (list.length) {
        setSlots((prev) => [...prev, ...list]);
        setPage(next);
        setHasMore(!!r?.has_more);
      } else {
        setHasMore(false);
      }
    } catch {
      notify.error("Failed to load more categories");
    } finally {
      setLoadingMore(false);
    }
  };

  const visible = slots.filter((s) => (s.products || []).length > 0);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      {bannersLoading ? (
        <Loader />
      ) : banners.length > 0 ? (
        <section className="container hero_banner" aria-label="Site banner">
          <div id="heroSlider" className="carousel slide" data-bs-ride="carousel">
            <div className="carousel-inner">
              {banners.map((b, i) => (
                <div
                  key={b.id ?? i}
                  className={`carousel-item ${i === 0 ? "active" : ""}`}
                >
                  <a href={b.link || "#"} target="_blank" rel="noopener noreferrer">
                    <img
                      className="hero_banner_img d-block w-100"
                      src={imgUrl(b.image)}
                      alt={b.title || ""}
                      fetchPriority={i === 0 ? "high" : "auto"}
                    />
                  </a>
                </div>
              ))}
            </div>
            {banners.length > 1 && (
              <>
                <button className="carousel-control-prev" type="button" data-bs-target="#heroSlider" data-bs-slide="prev">
                  <span className="carousel-control-prev-icon" aria-hidden="true" />
                  <span className="visually-hidden">Previous</span>
                </button>
                <button className="carousel-control-next" type="button" data-bs-target="#heroSlider" data-bs-slide="next">
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
                <div key={slot.id} style={{ display: "contents" }}>
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
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
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
