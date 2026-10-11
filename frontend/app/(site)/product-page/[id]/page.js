"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FaWhatsapp, FaMinus, FaPlus } from "react-icons/fa6";
import { api, asBoolean, imgUrl, formatTk, productColors, salePrice, statusBadge, isPreorderStatus, normalizedProductStatus, unwrapList, unwrapObject } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";
import notify from "@/components/notify";
import Loader from "@/components/Loader";
import SafeHtml from "@/components/SafeHtml";

import "@/styles/css/c609d21bcd0771ee.css";
import "@/styles/css/5aead8e379fe8d39.css";

/**
 * Product detail page (/product-page/[id])
 *  - Detail     : GET api/products/{id}
 *  - Related    : GET api/products?category={categorySlug}
 *  - Everything (price, stock, images, faqs, video) comes from the API.
 */
function safeVideoEmbed(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "www.youtube-nocookie.com") {
      const id = url.pathname.match(/\/embed\/([\w-]+)/)?.[1] || url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "player.vimeo.com" && /^\/video\/\d+/.test(url.pathname)) return url.href;
    if (host === "vimeo.com" || host === "www.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).at(-1);
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export default function ProductPage() {
  const { id } = useParams();
  const { addToCart, openCart, openCheckout } = useCart();
  const { social, flatCategories } = useSite();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeImage, setActiveImage] = useState(null);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [activeColor, setActiveColor] = useState(null);
  const [activeSize, setActiveSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("description");
  const [isNew, setIsNew] = useState(false);

  /* related products */
  const [related, setRelated] = useState([]);
  const [relLoading, setRelLoading] = useState(false);

  const rawWaNumber = (social?.whatsapp_number || "").replace(/[^0-9]/g, "");
  const waNumber = rawWaNumber
    ? rawWaNumber.startsWith("880")
      ? rawWaNumber
      : rawWaNumber.startsWith("0")
        ? `88${rawWaNumber}`
        : `880${rawWaNumber}`
    : "";

  /* ---------------- detail ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const r = await api.get(`api/products/${id}`, { auth: false });
        if (!alive) return;
        const p = unwrapObject(r);
        setProduct(p);
        if (p) {
          setActiveImage(imgUrl(p.images?.[0]) || imgUrl(p.image));
          setImageUnavailable(false);
          setActiveColor(p.colors?.[0] || null);
          setActiveSize(Array.isArray(p.sizes) && p.sizes.length === 1 ? p.sizes[0] : null);
          setQty(1);
          const createdAt = new Date(p.created_at || p.createdAt).getTime();
          setIsNew(Number.isFinite(createdAt) && Date.now() - createdAt < 7 * 864e5);
        } else {
          setLoadError("Product not found.");
        }
      } catch (error) {
        if (alive) {
          setProduct(null);
          setIsNew(false);
          setLoadError(error?.message || "Unable to load this product right now.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ---------------- related products ---------------- */
  const productCategory = Array.isArray(product?.category)
    ? product.category[0]
    : product?.category;
  const categorySlug = productCategory?.slug ||
    flatCategories.find((category) => String(category.id) === String(productCategory?.id))?.slug;

  useEffect(() => {
    if (!categorySlug) return;
    let alive = true;
    setRelLoading(true);
    api.get(`api/products?category=${encodeURIComponent(categorySlug)}`, { auth: false })
      .then((r) => {
        if (!alive) return;
        const list = unwrapList(r, ["products"]);
        setRelated(list.filter((item) => String(item.id) !== String(id)));
      })
      .catch(() => {
        if (alive) setRelated([]);
      })
      .finally(() => {
        if (alive) setRelLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [categorySlug, id]);

  if (loading) return <Loader />;
  if (!product) {
    return (
      <div className="container py-5">
        <div className="empty-state text-center">
          <h1 className="h4">Product unavailable</h1>
          <p className="text-muted mb-3">{loadError || "This product could not be found."}</p>
          <Link className="btn btn-outline-secondary" href="/shop">Back to shop</Link>
        </div>
      </div>
    );
  }

  /* ---------------- derived ---------------- */
  const badge = statusBadge(product);
  const status = normalizedProductStatus(product);
  const isPreorder = isPreorderStatus(status);
  const images = Array.isArray(product.images) ? product.images : [];
  const colors = productColors(product);
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const faqs = Array.isArray(product.faqs) ? product.faqs : [];
  const gallery = [
    ...images.map((image) => imgUrl(image)),
    ...colors.map((color) => imgUrl(color)),
  ].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);
  const primaryImage = activeImage || gallery[0] || null;
  const sizeObj = activeSize || (sizes.length === 1 ? sizes[0] : null);
  const combination = (product.inventory?.combinations || []).find(
    (item) =>
      (!sizeObj || String(item.size_id) === String(sizeObj.id)) &&
      (!activeColor || String(item.color_id) === String(activeColor.id))
  );
  const sizePrice = sizeObj?.pivot?.price;
  const customVariantPrice = sizePrice != null && sizePrice !== "" &&
    Number.isFinite(Number(sizePrice)) && Number(sizePrice) !== Number(product.price);
  const unitPrice = customVariantPrice ? Number(sizePrice) : salePrice(product);
  const originalPrice = Number(product.price) || 0;
  const hasComparePrice = unitPrice < originalPrice;
  const sizeStock = sizeObj?.pivot?.stock != null && Number.isFinite(Number(sizeObj.pivot.stock))
    ? Number(sizeObj.pivot.stock)
    : null;
  const comboStock = combination?.available != null && Number.isFinite(Number(combination.available))
    ? Number(combination.available)
    : null;
  const tracked = asBoolean(product.inventory?.track_inventory ?? product.track_inventory);
  const explicitOut = ["out-of-stock", "sold-out", "discontinued"].includes(status);
  const combinationOut = Boolean(combination && (
    (combination.in_stock === false && !combination.allow_preorder) ||
    (comboStock != null && comboStock <= 0 && !combination.allow_preorder)
  ));
  const stockOut = combination
    ? combinationOut
    : sizeStock != null
      ? sizeStock <= 0
      : product.stock != null && Number(product.stock) <= 0;
  const soldOut = !isPreorder && (explicitOut || (tracked && stockOut));
  const maxQty = comboStock ?? sizeStock ?? (
    product.stock != null && Number.isFinite(Number(product.stock)) ? Number(product.stock) : null
  );

  const selectImage = (image) => {
    setActiveImage(image);
    setImageUnavailable(false);
  };
  const waText = `Hello! I'm interested in this product: ${product.title || "Product"}. Can you provide more information?`;
  const videoEmbed = safeVideoEmbed(product.video_url);

  const handleAdd = async (mode) => {
    if (sizes.length > 1 && !activeSize) {
      notify.warn("Please select a size.");
      return;
    }
    if (soldOut) {
      notify.warn("This combination is sold out.");
      return;
    }
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        size: sizeObj?.id ?? "",
        size_label: sizeObj?.size ?? null,
        unitPrice,
        image: imgUrl(product.images?.[0]) || imgUrl(product.image) || "",
        colorImage: imgUrl(activeColor) || "",
        color_name: activeColor?.name || null,
        color_id: activeColor?.id ?? null,
        variant_id: combination?.variant_id ?? sizeObj?.id ?? null,
        product_color_id: combination?.product_color_id ?? activeColor?.id ?? null,
        qty,
        max_qty: maxQty != null && maxQty > 0 ? maxQty : null,
        is_preorder: isPreorder,
      });
    } catch {
      return;
    }
    if (mode === "buy") openCheckout();
    else openCart();
    setQty(1);
  };

  const tabs = {
    description: "Description",
    faq: "FAQ",
    video: "Product Video",
  };

  return (
    <div className="container py-4 single-prod">
      <div className="row">
        {/* ============ GALLERY ============ */}
        <div className="col-lg-6 mb-4">
          <div className="border rounded overflow-hidden bg-white text-center">
            {primaryImage && !imageUnavailable ? (
              <img
                src={primaryImage}
                alt={product.title}
                className="img-fluid"
                onError={() => setImageUnavailable(true)}
                style={{ maxHeight: 520, width: "100%", objectFit: "contain" }}
              />
            ) : (
              <div className="d-flex align-items-center justify-content-center text-muted" style={{ minHeight: 240 }}>
                No image available
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="d-flex gap-2 mt-2 flex-wrap product-gallery-thumbnails" aria-label="Product images">
              {gallery.slice(0, 10).map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => selectImage(image)}
                  aria-label={`View product image ${index + 1}`}
                  aria-pressed={activeImage === image}
                  className="product-thumbnail-button"
                >
                  <img
                    src={image}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                    onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ============ INFO ============ */}
        <div className="col-lg-6 mb-4">
          <h4 className="fw-bold mb-2">{product.title}</h4>

          <div className="d-flex align-items-center gap-3 mb-3 flex-wrap product-detail-pricing">
            {hasComparePrice && (
              <span className="text-decoration-line-through discount-price">
                {formatTk(originalPrice)}৳
              </span>
            )}
            <span className="fw-bold product-price" style={{ fontSize: 24 }}>
              {formatTk(unitPrice)}৳
            </span>
            {badge === "prebook" && (
              <span className="product_status_badge position-static px-3 py-1">
                PRE-BOOK
              </span>
            )}
            {badge === "in-stock" && (
              <span className="product_status_badge in-stock-badge position-static px-3 py-1">
                IN STOCK
              </span>
            )}
            {badge === "sold-out" && (
              <span className="product_status_badge sold-out-badge position-static px-3 py-1">
                SOLD OUT
              </span>
            )}
            {isNew && (
              <span
                className="px-2 py-1 small fw-semibold rounded"
                style={{ background: "#111", color: "#fff" }}
              >
                new
              </span>
            )}
          </div>

          {product.short_description && (
            <p className="text-muted">{product.short_description}</p>
          )}

          <div
            className="alert py-2 px-3 d-inline-flex align-items-center gap-2"
            style={{ background: "#e9f7f1", color: "#0f6b52", fontSize: 14 }}
          >
            ⚡Delivery Time 2 to 4 Days
          </div>

          {/* colors */}
          {colors.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold small mb-2">
                Colour{activeColor ? `: ${activeColor.name}` : ""}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                {colors.map((color, index) => {
                  const colorImage = imgUrl(color);
                  const selected = String(activeColor?.id) === String(color.id);
                  const colorCode = /^#[\da-f]{3,8}$/i.test(String(color.code || "")) ? color.code : "#e5e7eb";
                  return (
                    <button
                      key={color.id ?? color.name ?? index}
                      type="button"
                      title={color.name || "Product colour"}
                      aria-label={`Choose ${color.name || "product colour"}`}
                      aria-pressed={selected}
                      onClick={() => {
                        setActiveColor(color);
                        if (colorImage) selectImage(colorImage);
                      }}
                      className="product-color-choice"
                      style={{ borderColor: selected ? "var(--primary-color)" : "#dee2e6" }}
                    >
                      {colorImage ? (
                        <img src={colorImage} alt="" width={40} height={40} loading="lazy" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="product-color-swatch"
                          style={{ backgroundColor: colorCode }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* sizes */}
          {sizes.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold small mb-2">Size</div>
              <div className="d-flex gap-2 flex-wrap" role="group" aria-label="Choose size">
                {sizes.map((size) => {
                  const active = String(activeSize?.id) === String(size.id);
                  const stock = size.pivot?.stock != null ? Number(size.pivot.stock) : null;
                  const out = !isPreorder && (
                    ["out-of-stock", "sold-out", "discontinued"].includes(status) ||
                    (tracked && stock != null && stock <= 0)
                  );
                  return (
                    <button
                      key={size.id}
                      type="button"
                      className={`product-size-choice ${active ? "is-selected" : ""}`}
                      disabled={out}
                      aria-pressed={active}
                      onClick={() => {
                        setActiveSize(size);
                        if (stock != null && stock > 0) setQty((quantity) => Math.min(quantity, stock));
                      }}
                      title={
                        out
                          ? "Sold out"
                          : size.pivot?.price != null
                            ? `${formatTk(size.pivot.price)}৳`
                            : ""
                      }
                    >
                      {size.size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {soldOut && (
            <div className="text-danger small fw-semibold mb-2">
              Sold out in this combination
            </div>
          )}

          {/* qty */}
          <div className="d-flex align-items-center gap-3 mb-4">
            <div className="d-flex align-items-center border rounded">
              <button
                type="button"
                className="border-0 bg-white px-3 py-2"
                aria-label="Decrease quantity"
                disabled={qty <= 1}
                onClick={() => setQty((quantity) => Math.max(1, quantity - 1))}
              >
                <FaMinus size={11} />
              </button>
              <span className="px-3 fw-semibold" aria-live="polite">{qty}</span>
              <button
                type="button"
                className="border-0 bg-white px-3 py-2"
                aria-label="Increase quantity"
                disabled={maxQty != null && qty >= maxQty}
                onClick={() => setQty((quantity) => maxQty != null ? Math.min(maxQty, quantity + 1) : quantity + 1)}
              >
                <FaPlus size={11} />
              </button>
            </div>
            <span className="text-muted small">
              {soldOut ? "Out of stock" : isPreorder ? "Available for pre-order" : tracked ? "Limited stock" : "Ships nationwide"}
            </span>
          </div>

          {/* actions */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <button
              type="button"
              className="single-prod-action-btn btn-grad px-4 py-2 fw-semibold"
              disabled={soldOut || (sizes.length > 1 && !activeSize)}
              onClick={() => handleAdd("cart")}
            >
              Add to Cart
            </button>
            <button
              type="button"
              className="single-prod-action-btn btn-grad px-4 py-2 fw-semibold"
              disabled={soldOut || (sizes.length > 1 && !activeSize)}
              onClick={() => handleAdd("buy")}
            >
              {isPreorder ? "Pre-order Now" : "Buy Now"}
            </button>
          </div>

          {/* Support contact is shown only when the backend has supplied a number. */}
          {waNumber && (
            <div className="social-buttons-container d-flex gap-2">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-success btn-sm d-flex align-items-center gap-2"
              >
                <FaWhatsapp /> Ask on WhatsApp
              </a>
            </div>
          )}

          {/* specifications */}
          {specifications.length > 0 && (
            <div className="mt-4 border rounded p-3">
              <div className="fw-semibold mb-2">Product Specifications</div>
              <table className="table table-sm mb-0 small">
                <tbody>
                  {specifications.map((s, i) => (
                    <tr key={i}>
                      <td className="text-muted" style={{ width: "40%" }}>
                        {s.key}
                      </td>
                      <td>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="mt-3">
        <ul className="nav nav-pills gap-2 mb-3">
          {Object.entries(tabs).map(([key, label]) => (
            <li className="nav-item" key={key}>
              <button
                className={`nav-link ${tab === key ? "active" : ""}`}
                style={
                  tab === key
                    ? { background: "var(--primary-color)", color: "#fff" }
                    : { color: "#333", border: "1px solid #dee2e6" }
                }
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div className="border rounded p-3 bg-white product-information-panel">
          {tab === "description" && (
            product.description || product.short_description ? (
              <SafeHtml
                className="product_desc cms-content"
                html={product.description || product.short_description}
              />
            ) : (
              <p className="text-muted mb-0">No description available.</p>
            )
          )}
          {tab === "faq" &&
            (faqs.length ? (
              <div className="accordion">
                {faqs.map((faq, index) => (
                  <article className="product-faq-item mb-3" key={faq.id ?? index}>
                    <h3 className="h6 fw-semibold mb-2">{faq.question}</h3>
                    <SafeHtml className="text-muted small cms-content" html={faq.answer || ""} />
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-muted mb-0">No FAQs found.</p>
            ))}
          {tab === "video" &&
            (videoEmbed ? (
              <div className="ratio ratio-16x9 product-video">
                <iframe
                  src={videoEmbed}
                  title={`${product.title || "Product"} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="text-muted mb-0">No supported product video is available.</p>
            ))}
        </div>
      </div>

      {/* ============ RELATED ============ */}
      <div className="mt-5">
        <small className="featured-heading d-block mb-3">
          Related Products
        </small>
        {related.length === 0 && !relLoading ? (
          <p className="text-muted small">No products found</p>
        ) : (
          <>
            <div className="row mx-0">
              {related.map((p, i) => (
                <div key={`${p.id}-${i}`} className="col-6 col-md-4 col-lg-3 px-1 px-md-2 mb-3">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            {relLoading && (
              <div className="text-center py-3 small text-muted">
                <span className="spinner-border spinner-border-sm me-2" />
                Loading more products...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
