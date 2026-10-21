"use client";

import { useEffect, useState } from "react";
import { FiCreditCard, FiMessageCircle, FiTruck } from "react-icons/fi";
import CategoryRow from "@/components/site/CategoryRow";
import Hero from "@/components/site/Hero";
import { ErrorState, Skeleton } from "@/components/ui";
import { useSite } from "@/context/SiteContext";
import { api, imgUrl, listOf } from "@/lib/api";

function normalizeBanner(raw) {
  return {
    id: raw.id,
    image: imgUrl(raw.image),
    link: typeof raw.link === "string" && raw.link.startsWith("/") ? raw.link : raw.link || "",
    title: raw.title || "",
  };
}

export default function HomePage() {
  const { siteName, categories, social, loading: siteLoading } = useSite();
  const [banners, setBanners] = useState({ loading: true, error: "", items: [] });

  useEffect(() => {
    let alive = true;
    api
      .get("api/banners", { auth: false })
      .then((response) => {
        if (!alive) return;
        const items = listOf(response)
          .filter((b) => b && b.is_active !== false && b.image)
          .map(normalizeBanner)
          .filter((b) => b.image);
        setBanners({ loading: false, error: "", items });
      })
      .catch((error) => alive && setBanners({ loading: false, error: error.message, items: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const rows = [...categories.flat].sort((a, b) => Number(b.homepage) - Number(a.homepage));
  const hasCategoryNav = categories.flat.length > 0;

  return (
    <>
      <div className="container" style={{ paddingTop: "1.25rem" }}>
        {banners.loading ? (
          <div className="hero">
            <Skeleton style={{ position: "absolute", inset: 0, borderRadius: 0 }} />
          </div>
        ) : banners.error ? (
          <ErrorState message={`Banners could not be loaded. ${banners.error}`} />
        ) : (
          <Hero banners={banners.items} siteName={siteName} />
        )}

        <div className="feature-strip stagger">
          <div className="feature">
            <span className="feature-icon"><FiCreditCard aria-hidden="true" /></span>
            <div>
              <strong>Cash on delivery</strong>
              <span>Pay when your order arrives</span>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon"><FiTruck aria-hidden="true" /></span>
            <div>
              <strong>Dhaka & outside Dhaka</strong>
              <span>Delivery across Bangladesh</span>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon"><FiMessageCircle aria-hidden="true" /></span>
            <div>
              <strong>Order support</strong>
              <span>
                {social.whatsapp ? "Message us on WhatsApp" : "Reach us through the contact details below"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {rows.map((category) => (
        <div key={category.id} className="container">
          <CategoryRow category={category} />
        </div>
      ))}

      {!siteLoading && !hasCategoryNav && banners.items.length === 0 && (
        <div className="container section">
          <div className="empty">
            <h3>The store is being set up</h3>
            <p>Categories, banners and products will appear here as soon as they are published from the admin panel.</p>
          </div>
        </div>
      )}
    </>
  );
}
