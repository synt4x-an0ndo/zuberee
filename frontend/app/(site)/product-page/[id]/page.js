"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { FaWhatsapp, FaMinus, FaPlus, FaVideo, FaRulerCombined } from "react-icons/fa6";
import { MessengerIcon } from "@/components/Icons";
import { api, imgUrl, formatTk, statusBadge, unwrapList, unwrapObject, API_BASE } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";
import notify from "@/components/notify";
import Loader from "@/components/Loader";

import "@/styles/css/c609d21bcd0771ee.css";
import "@/styles/css/5aead8e379fe8d39.css";

/**
 * Product detail page (/product-page/[id])
 *  - Detail     : GET api/products/{id}
 *  - Related    : GET api/products?category={categorySlug}
 *  - Everything (price, stock, images, faqs, video) comes from the API.
 */
export default function ProductPage({ params }) {
  const { id } = use(params);
  const { addToCart, openCart, openCheckout } = useCart();
  const { social, flatCategories } = useSite();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(null);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [activeColor, setActiveColor] = useState(null);
  const [activeSize, setActiveSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("description");

  /* related products */
  const [related, setRelated] = useState([]);
  const [relLoading, setRelLoading] = useState(false);

  const waNumber = (social?.whatsapp_number || "").replace(/[^0-9]/g, "");

  /* ---------------- detail ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`api/products/${id}`, { auth: false });
        if (!alive) return;
        const p = unwrapObject(r);
        setProduct(p);
        if (p) {
          setActiveImage(imgUrl(p.images?.[0]) || imgUrl(p.image));
          setImageUnavailable(false);
          setActiveColor(p.colors?.[0] || null);
          setActiveSize(null);
          setQty(1);
        }
      } catch {
        notify.error("Failed to load product");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ---------------- related products ---------------- */
  const categorySlug = product?.category?.length
    ? flatCategories.find((c) => c.id === product.category[0].id)?.slug
    : null;

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
  if (!product)
    return <div className="text-center py-5 text-muted">Product not found</div>;

  /* ---------------- derived ---------------- */
  const badge = statusBadge(product);
  const images = Array.isArray(product.images) ? product.images : [];
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const faqs = Array.isArray(product.faqs) ? product.faqs : [];
  const gallery = [
    ...images.map((im) => imgUrl(im)),
    ...colors
      .map((c) => imgUrl(c)),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const primaryImage = activeImage || gallery[0] || null;

  const combination = (product.inventory?.combinations || []).find(
    (c) =>
      (activeSize == null || String(c.size_id) === String(activeSize.id)) &&
      (!activeColor || String(c.color_id) === String(activeColor.id))
  );

  const sizeObj = activeSize || sizes[0] || null;
  const sizePrice = sizeObj?.pivot?.price;
  const unitPrice =
    sizePrice != null && sizePrice !== ""
      ? Number(sizePrice)
      : product.discount
        ? Number(product.discount)
        : Number(product.price) || 0;

  const sizeStock =
    sizeObj?.pivot?.stock != null ? Number(sizeObj.pivot.stock) : null;
  const comboStock = combination ? Number(combination.available) : null;
  const tracked = !!product.inventory?.track_inventory || !!product.track_inventory;
  const soldOut = tracked
    ? comboStock != null
      ? combination && !combination.in_stock && !combination.allow_preorder
        ? true
        : comboStock <= 0 && product.status !== "prebook"
      : sizeStock === 0 && product.status !== "prebook"
    : false;

  const maxQty = combination?.available ?? sizeStock ?? null;
  const isNew =
    product.created_at &&
    Date.now() - new Date(product.created_at).getTime() < 7 * 864e5;

  const waText = `Hello! I'm interested in this product: ${product.title || "Product"
    }. Can you provide more information?`;

  const handleAdd = async (mode) => {
    if (sizes.length > 1 && !activeSize && !sizeObj) {
      notify.warn("Please Select A Size");
      return;
    }
    if (soldOut) {
      notify.warn("Sold out in this combination");
      return;
    }
    await addToCart({
      id: product.id,
      title: product.title,
      size: sizeObj?.id ?? "",
      size_label: sizeObj?.size ?? null,
      unitPrice: unitPrice,
      image: imgUrl(product.images?.[0]) || imgUrl(product.image) || "",
      colorImage: imgUrl(activeColor) || "",
      color_name: activeColor?.name || null,
      color_id: activeColor?.id ?? null,
      variant_id: combination?.variant_id ?? sizeObj?.id ?? null,
      product_color_id: combination?.product_color_id ?? activeColor?.id ?? null,
      qty,
      max_qty: maxQty && maxQty > 0 ? maxQty : null,
      is_preorder: product.status === "prebook",
    });
    if (mode === "buy") {
      openCheckout();
    } else {
      notify.success("Added to cart!");
      openCart();
    }
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
          <div className="d-flex gap-2 mt-2 flex-wrap">
            {gallery.slice(0, 10).map((g, i) => (
              <img
                key={`${g}-${i}`}
                src={g}
                alt=""
                width={64}
                height={64}
                onClick={() => setActiveImage(g)}
                style={{
                  objectFit: "cover",
                  borderRadius: 6,
                  cursor: "pointer",
                  border:
                    activeImage === g
                      ? "2px solid var(--primary-color)"
                      : "1px solid #dee2e6",
                }}
              />
            ))}
          </div>
        </div>

        {/* ============ INFO ============ */}
        <div className="col-lg-6 mb-4">
          <h4 className="fw-bold mb-2">{product.title}</h4>

          <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
            <span className="text-decoration-line-through discount-price">
              {formatTk(product.price)}৳
            </span>
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
                IN-STOCK
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
                {colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => {
                      setActiveColor(c);
                      if (imgUrl(c)) setActiveImage(imgUrl(c));
                    }}
                    className="border rounded p-1 bg-white"
                    style={{
                      borderColor:
                        activeColor?.id === c.id
                          ? "var(--primary-color)"
                          : "#dee2e6",
                      borderWidth: activeColor?.id === c.id ? 2 : 1,
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={imgUrl(c)}
                      alt={c.name}
                      width={40}
                      height={40}
                      style={{ objectFit: "cover", borderRadius: 4 }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* sizes */}
          {sizes.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold small mb-2">Size</div>
              <div className="d-flex gap-2 flex-wrap">
                {sizes.map((s) => {
                  const active = (activeSize?.id ?? sizes[0]?.id) === s.id;
                  const stock = Number(s.pivot?.stock);
                  const out = tracked && stock <= 0 && product.status !== "prebook";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="btn btn-sm border"
                      disabled={out}
                      onClick={() => setActiveSize(s)}
                      style={{
                        minWidth: 46,
                        background: active ? "var(--primary-color)" : "#fff",
                        color: active ? "#fff" : "#333",
                        opacity: out ? 0.45 : 1,
                        textDecoration: out ? "line-through" : "none",
                      }}
                      title={
                        out
                          ? "Sold out"
                          : s.pivot?.price != null
                            ? `${formatTk(s.pivot.price)}৳`
                            : ""
                      }
                    >
                      {s.size}
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
                className="border-0 bg-white px-3 py-2"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <FaMinus size={11} />
              </button>
              <span className="px-3 fw-semibold">{qty}</span>
              <button
                className="border-0 bg-white px-3 py-2"
                onClick={() =>
                  setQty((q) =>
                    maxQty && maxQty > 0 ? Math.min(maxQty, q + 1) : q + 1
                  )
                }
              >
                <FaPlus size={11} />
              </button>
            </div>
            <span className="text-muted small">
              {tracked ? "In stock" : "Ships nationwide"}
            </span>
          </div>

          {/* actions */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <button
              className="single-prod-action-btn btn-grad px-4 py-2 fw-semibold"
              disabled={soldOut}
              onClick={() => handleAdd("cart")}
            >
              Add to Cart
            </button>
            <button
              className="single-prod-action-btn btn-grad px-4 py-2 fw-semibold"
              disabled={soldOut}
              onClick={() => handleAdd("buy")}
            >
              {product.status === "prebook" ? "Pre-order Now" : "Buy Now"}
            </button>
          </div>

          {/* social share */}
          <div className="social-buttons-container d-flex gap-2">
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-success btn-sm d-flex align-items-center gap-2"
            >
              <FaWhatsapp /> WhatsApp
            </a>
            <a
              href="https://m.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
            >
              <MessengerIcon /> Messenger
            </a>
          </div>

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

        <div className="border rounded p-3 bg-white">
          {tab === "description" && (
            <div
              className="product_desc"
              dangerouslySetInnerHTML={{
                __html:
                  product.description ||
                  product.short_description ||
                  "<p class='text-muted'>No description available.</p>",
              }}
            />
          )}
          {tab === "faq" &&
            (faqs.length ? (
              <div className="accordion">
                {faqs.map((f, i) => (
                  <div className="mb-2" key={i}>
                    <div className="fw-semibold">{f.question}</div>
                    <div
                      className="text-muted small"
                      dangerouslySetInnerHTML={{ __html: f.answer }}
                    />
                    <hr />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted mb-0">No FAQs found.</p>
            ))}
          {tab === "video" &&
            (product.video_url ? (
              <div className="ratio ratio-16x9">
                <iframe
                  src={product.video_url}
                  title="Product video"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="text-muted mb-0">No video available.</p>
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
