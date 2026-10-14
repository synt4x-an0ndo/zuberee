"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Img from "@/components/Img";
import { cx } from "@/components/ui";

const INTERVAL = 6500;

/** Auto-rotating banner carousel. Banners are admin-managed; with none, a text hero is shown. */
export default function Hero({ banners, siteName, primaryAction = { href: "/shop", label: "Shop now" } }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL);
    return () => clearInterval(timer);
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) {
    return (
      <section className="hero" aria-label="Welcome">
        <div className="hero-copy">
          <p className="eyebrow anim-fade-up">{siteName || "Welcome"}</p>
          <h1 className="anim-fade-up">Fresh arrivals, delivered to your door.</h1>
          <p className="anim-fade-up">Browse the latest styles and order with cash on delivery.</p>
          <div className="btn-row anim-fade-up">
            <Link href={primaryAction.href} className="btn btn-light btn-lg">
              {primaryAction.label}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banners.map((banner, i) => (
        <div
          key={banner.id}
          className={cx("hero-slide", i === index && "is-active", banner.link && "is-link")}
          aria-hidden={i !== index}
        >
          {banner.image && <Img src={banner.image} alt={banner.title || siteName || "Banner"} fill priority={i === 0} sizes="100vw" />}
          {banner.link && <Link href={banner.link} className="hero-link" aria-label={banner.title || "Open banner link"} />}
        </div>
      ))}
      {count > 1 && (
        <div className="hero-dots" role="group" aria-label="Choose banner">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              className={cx(i === index && "is-active")}
              onClick={() => setIndex(i)}
              aria-label={`Show banner ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
