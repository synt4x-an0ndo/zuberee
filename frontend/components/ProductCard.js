"use client";

import Link from "next/link";
import { useState } from "react";
import { imgUrl, formatTk, productColors, salePrice, statusBadge } from "@/lib/api";

export default function ProductCard({ product }) {
  const [preview, setPreview] = useState(null);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  if (!product) return null;

  const firstImage = imgUrl(product.images?.[0]) || imgUrl(product.image);
  const mainImage = preview || firstImage;
  const badge = statusBadge(product);
  const colors = productColors(product);
  const price = Number(product.price) || 0;
  const currentPrice = salePrice(product);
  const hasDiscount = currentPrice < price;

  const selectPreview = (image) => {
    if (!image) return;
    setImageUnavailable(false);
    setPreview((current) => current === image ? null : image);
  };

  return (
    <article className="product-tile">
      <div className="card product-div product-card h-100">
        <Link
          href={`/product-page/${product.id}`}
          className="product-card-image-link"
          aria-label={`View ${product.title || "product"}`}
        >
          <div className="product-image-container">
            {mainImage && !imageUnavailable ? (
              <img
                src={mainImage}
                alt={product.title || "Product"}
                className="product-image"
                loading="lazy"
                decoding="async"
                onError={() => setImageUnavailable(true)}
              />
            ) : (
              <div className="product-image-placeholder" aria-label="Product image unavailable">
                <span aria-hidden="true">Image unavailable</span>
              </div>
            )}
            {hasDiscount && <span className="product-sale-pill">Sale</span>}
          </div>
        </Link>

        <div className="product-card-body">
          <Link href={`/product-page/${product.id}`} className="product-card-title-link">
            <h2 className="product-card-title" title={product.title || "Product"}>
              {product.title || "Product"}
            </h2>
          </Link>

          <div className="product-card-pricing" aria-label={`Price ${formatTk(currentPrice)} taka`}>
            {hasDiscount && <span className="product-card-original-price">{formatTk(price)}৳</span>}
            <span className="product-card-current-price">{formatTk(currentPrice)}৳</span>
          </div>

          {colors.length > 0 && (
            <div className="product-card-swatches" aria-label="Available colours">
              {colors.slice(0, 4).map((color, index) => {
                const image = imgUrl(color);
                const selected = image && preview === image;
                const colorCode = /^#[\da-f]{3,8}$/i.test(String(color.code || "")) ? color.code : "#e5e7eb";
                const key = color.id ?? `${color.name || "colour"}-${index}`;
                return image ? (
                  <button
                    key={key}
                    type="button"
                    className={`product-card-swatch ${selected ? "is-selected" : ""}`}
                    title={color.name || "Colour"}
                    aria-label={`Preview ${color.name || "colour"}`}
                    aria-pressed={Boolean(selected)}
                    onClick={() => selectPreview(image)}
                  >
                    <img src={image} alt="" loading="lazy" />
                  </button>
                ) : (
                  <span
                    key={key}
                    className="product-card-swatch"
                    title={color.name || "Colour"}
                    style={{ backgroundColor: colorCode }}
                  />
                );
              })}
              {colors.length > 4 && <span className="product-card-more-colors">+{colors.length - 4}</span>}
            </div>
          )}
        </div>
      </div>

      {badge === "prebook" && <span className="product-card-status product-card-status--prebook">PRE-ORDER</span>}
      {badge === "in-stock" && <span className="product-card-status product-card-status--stock">IN STOCK</span>}
      {badge === "sold-out" && <span className="product-card-status product-card-status--sold">SOLD OUT</span>}
    </article>
  );
}
