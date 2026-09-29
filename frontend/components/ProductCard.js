"use client";

import Link from "next/link";
import { useState } from "react";
import { imgUrl, formatTk, statusBadge } from "@/lib/api";

/**
 * Product card - same markup/classes as the original storefront:
 * image (+ clickable colour swatches that swap the preview), title,
 * original price struck through + sale price, PRE-BOOK / IN-STOCK badge.
 */
export default function ProductCard({ product }) {
  const [preview, setPreview] = useState(null);
  if (!product) return null;

  const firstImage = product.images?.[0]?.image || product.image || null;
  const main = preview || firstImage;
  const badge = statusBadge(product);
  const colors = Array.isArray(product.colors) ? product.colors : [];

  return (
    <div className="my-2 my-md-5 position-relative">
      <div className="card product-div p-1 p-md-2 bg-white h-100 product-card position-relative d-flex flex-column">
        <Link
          href={`/frontEnd/product-page/${product.id}`}
          style={{ textDecoration: "none", order: 0 }}
        >
          <div className="position-relative overflow-hidden product-image-container">
            {main ? (
              <img
                src={imgUrl(main)}
                className="product-image p-0 p-md-3"
                alt={product.title || "Product"}
              />
            ) : (
              <div className="product-image p-0 p-md-3 bg-light" />
            )}
          </div>
        </Link>

        {colors.length > 0 && (
          <div
            className="d-flex align-items-center gap-2 px-2 px-md-3 mt-1 mt-lg-2 pb-2"
            style={{ order: 3 }}
          >
            <div className="product-color-wrapper d-flex gap-2">
              {colors.slice(0, 3).map((c, i) => (
                <div
                  key={c.id ?? i}
                  className={preview && preview === imgUrl(c.image) ? "SelectedImageStyle" : "product_color_image_div"}
                  onClick={() =>
                    setPreview((p) =>
                      p === imgUrl(c.image) ? null : imgUrl(c.image)
                    )
                  }
                >
                  <img
                    width={30}
                    height={30}
                    src={imgUrl(c.image)}
                    alt={c.name || "Color variant"}
                    className="h-100 w-100"
                  />
                </div>
              ))}
              {colors.length > 3 && (
                <small className="text-muted">+{colors.length - 3}</small>
              )}
            </div>
          </div>
        )}

        <Link
          href={`/frontEnd/product-page/${product.id}`}
          style={{ textDecoration: "none", order: 1 }}
        >
          <div className="px-2 px-md-3 pt-2 pt-md-3 pb-0">
            <p className="mb-1">
              <small
                className="text-decoration-none fw-bold product-card-title text-truncate d-block"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {product.title}
              </small>
            </p>
          </div>
        </Link>

        <div className="px-2 px-md-3 pb-1" style={{ order: 2 }}>
          <div className="d-flex gap-3 align-items-center mt-1 mt-md-2">
            <span className="discount-price text-decoration-line-through">
              {formatTk(product.price ?? 0)}৳
            </span>
            {product.discount && (
              <span className="fw-bold product-price">
                {formatTk(product.discount)}৳
              </span>
            )}
          </div>
        </div>
      </div>

      {badge === "prebook" && (
        <div className="position-absolute m-2 px-2 px-md-3 py-1 shadow-sm product_status_badge">
          PRE-BOOK
        </div>
      )}
      {badge === "in-stock" && (
        <div className="position-absolute m-2 px-2 px-md-3 py-1 shadow-sm product_status_badge in-stock-badge">
          IN-STOCK
        </div>
      )}
    </div>
  );
}
