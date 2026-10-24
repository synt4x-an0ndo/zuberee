"use client";

import AlignedTable from "@/components/AlignedTable";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    FiArrowLeft,
    FiChevronLeft,
  FiChevronRight,
  FiMinus,
  FiPackage,
  FiPhoneCall,
  FiPlay,
  FiPlus,
  FiShoppingCart,
  FiTruck,
  FiClock,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import { FaFacebookMessenger, FaRuler, FaWhatsapp } from "react-icons/fa";
import Img from "@/components/Img";
import ProductCard from "@/components/ProductCard";
import SafeHtml from "@/components/SafeHtml";
import { Button, cx, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, formatMoney, listOf, unwrap } from "@/lib/api";
import { discountPercent, normalizeProduct } from "@/lib/format";

const GALLERY_AUTOPLAY_MS = 4000;
const GALLERY_RESUME_MS = 8000;
const GALLERY_SWIPE_THRESHOLD = 45;

function ProductDetailSkeleton() {
  return (
    <div className="container section" style={{ paddingTop: "1.5rem" }}>
      <div className="pdp">
        <Skeleton style={{ aspectRatio: "4 / 5", borderRadius: 20 }} />
        <div style={{ display: "grid", gap: 14 }}>
          <Skeleton style={{ height: 30, width: "75%" }} />
          <Skeleton style={{ height: 22, width: "30%" }} />
          <Skeleton style={{ height: 44, width: "100%", marginTop: 20 }} />
          <Skeleton style={{ height: 44, width: "100%" }} />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const { categories, social, siteName } = useSite();
  const { addItem } = useCart();
  const { toast } = useFeedback();

  const [state, setState] = useState({ loading: true, error: "", product: null });
  const [related, setRelated] = useState([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [hoverZoomed, setHoverZoomed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const autoplayResumeRef = useRef(null);
  const swipeRef = useRef(null);
  const [colorId, setColorId] = useState(null);
  const [sizeId, setSizeId] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "", product: null });
    api
      .get(`api/products/${id}`, { auth: false })
      .then((response) => {
        if (!alive) return;
        const product = normalizeProduct(unwrap(response));
        if (!product) throw new Error("Product not found.");
        setState({ loading: false, error: "", product });
        setImageIndex(0);
        setGalleryPaused(false);
        setHoverZoomed(false);
        setZoomed(false);
        setColorId(product.colors[0]?.id ?? null);
        setSizeId(null);
        setQty(1);
      })
      .catch((error) => alive && setState({ loading: false, error: error.message, product: null }));
    return () => {
      alive = false;
    };
  }, [id]);

  const product = state.product;
  const categorySlug = product?.category?.slug;

  useEffect(() => {
    if (!product || !categorySlug) return undefined;
    let alive = true;
    api
      .get("api/product-pagination", { auth: false, params: { category: categorySlug, per_page: 8 } })
      .then((response) => {
        if (!alive) return;
        setRelated(listOf(response).map(normalizeProduct).filter((p) => p && p.id !== product.id).slice(0, 4));
      })
      .catch(() => alive && setRelated([]));
    return () => {
      alive = false;
    };
  }, [product, categorySlug]);

  const color = useMemo(() => product?.colors.find((c) => c.id === colorId) || null, [product, colorId]);
  const size = useMemo(() => product?.sizes.find((s) => s.id === sizeId) || null, [product, sizeId]);

  // Gallery: product images, plus the selected colour's swatch image when it has one.
  const gallery = useMemo(() => {
    if (!product) return [];
    const base = product.images.map((img) => img.url);
    if (color?.image && !base.includes(color.image)) return [color.image, ...base];
    return base;
  }, [product, color]);

  const pauseGalleryTemporarily = () => {
    setGalleryPaused(true);
    if (autoplayResumeRef.current) window.clearTimeout(autoplayResumeRef.current);
    autoplayResumeRef.current = window.setTimeout(() => setGalleryPaused(false), GALLERY_RESUME_MS);
  };

  useEffect(() => () => {
    if (autoplayResumeRef.current) window.clearTimeout(autoplayResumeRef.current);
  }, []);

  useEffect(() => {
    if (gallery.length > 0 && imageIndex >= gallery.length) setImageIndex(0);
  }, [gallery.length, imageIndex]);

  useEffect(() => {
    if (gallery.length <= 1 || galleryPaused || zoomed) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setImageIndex((index) => (index + 1) % gallery.length);
    }, GALLERY_AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [gallery.length, galleryPaused, imageIndex, zoomed]);

  if (state.loading) return <ProductDetailSkeleton />;
  if (state.error) {
    return (
      <div className="container section">
        <ErrorState message={state.error} />
      </div>
    );
  }
  if (!product) return null;

  const hasSizes = product.sizes.length > 0;
  const sizeSelected = hasSizes ? size : true;
  const unavailable = product.availability === "sold-out";
  const preorder = product.availability === "pre-order";
  const stockLeft = size ? size.stock : product.sizes.reduce((sum, s) => sum + s.stock, 0);
  const selectedCapacity = size ? size.orderCapacity : product.orderCapacity;
  const maxQty = selectedCapacity === null || selectedCapacity === undefined ? 99 : Math.max(1, selectedCapacity);

  // Price: a size may carry its own price; otherwise the product sale price applies.
  const sizeOwnPrice = size && size.price !== null && size.price !== product.price ? size.price : null;
  const current = sizeOwnPrice ?? product.salePrice;
  const was = current < product.price ? product.price : null;
  const off = was ? discountPercent(product.price, current) : 0;
  const category = categories.bySlug.get(categorySlug);

  const addToCart = async (then) => {
    if (!sizeSelected) {
      toast.error("Please choose a size first.");
      return;
    }
    if (selectedCapacity !== null && selectedCapacity !== undefined && qty > selectedCapacity) {
      toast.error(size?.allowPreorder || preorder
        ? `Only ${selectedCapacity} can be ordered, including pre-order.`
        : `Only ${selectedCapacity} available in stock.`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await addItem({ productId: product.id, variantId: size?.id ?? null, colorId: color?.id ?? null, quantity: qty });
      if (then === "checkout") router.push("/checkout");
      else toast.success(`${product.title} added to your cart`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel = unavailable ? "Sold out" : preorder ? "Pre-order Now" : "Add to Cart";

  // Zuberee-style contact buttons: Messenger from the Facebook page, WhatsApp
  // from the store number (BD local numbers get the 880 country code).
  const fb = (social?.facebook || "").trim();
  let messengerUrl = "";
  if (fb) {
    const seg = fb.replace(/\/+$/, "").split("/").pop() || "";
    messengerUrl = seg && !seg.includes("?") && seg !== "profile.php" ? `https://m.me/${seg}` : fb;
  }
  const waRaw = (social?.whatsapp || "").replace(/\D/g, "");
  const waDigits = waRaw.startsWith("0") ? `880${waRaw.slice(1)}` : waRaw;
  const whatsappUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        `Hello ${siteName || "there"}, I want to know more about "${product.title}"${product.sku ? ` (SKU: ${product.sku})` : ""}.`
      )}`
    : "";
  const selectGalleryImage = (index) => {
    if (!gallery.length) return;
    setImageIndex(((index % gallery.length) + gallery.length) % gallery.length);
    setHoverZoomed(false);
    setZoomed(false);
    pauseGalleryTemporarily();
  };
  const prevImg = () => selectGalleryImage(imageIndex - 1);
  const nextImg = () => selectGalleryImage(imageIndex + 1);

  const updateZoomOrigin = (event) => {
    const frame = event.currentTarget;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
    frame.style.setProperty("--zoom-x", `${x}%`);
    frame.style.setProperty("--zoom-y", `${y}%`);
  };

  const handleGalleryPointerDown = (event) => {
    pauseGalleryTemporarily();
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (event.pointerType === "mouse" || zoomed) updateZoomOrigin(event);
  };

  const handleGalleryPointerMove = (event) => {
    if (event.pointerType === "mouse") {
      updateZoomOrigin(event);
      if (!zoomed) setHoverZoomed(true);
    } else if (zoomed) {
      updateZoomOrigin(event);
    }
  };

  const handleGalleryPointerUp = (event) => {
    const swipe = swipeRef.current;
    swipeRef.current = null;
    if (!swipe || swipe.pointerId !== event.pointerId || gallery.length <= 1 || zoomed) return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (Math.abs(deltaX) < GALLERY_SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    if (deltaX < 0) nextImg();
    else prevImg();
  };

  const handleGalleryPointerCancel = () => {
    swipeRef.current = null;
  };

  const toggleZoom = () => {
    if (!gallery[imageIndex]) return;
    setZoomed((current) => !current);
    pauseGalleryTemporarily();
  };

  const handleGalleryKeyDown = (event) => {
    if (event.key === "ArrowLeft" && gallery.length > 1) {
      event.preventDefault();
      prevImg();
    } else if (event.key === "ArrowRight" && gallery.length > 1) {
      event.preventDefault();
      nextImg();
    } else if ((event.key === "Enter" || event.key === " ") && gallery[imageIndex]) {
      event.preventDefault();
      toggleZoom();
    }
  };

  return (
    <div className="pd2-bg">
      <div className="container section" style={{ paddingTop: "1.25rem" }}>
        <button
          type="button"
          className="pd2-back"
          onClick={() => (typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push("/shop"))}
          aria-label="Go back to the previous page"
        >
          <FiArrowLeft aria-hidden="true" /> Back
        </button>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          {category && <Link href={`/${category.slug}`}>{category.name}</Link>}
          {category && <span>/</span>}
          <span style={{ color: "var(--ink-2)" }}>{product.title}</span>
        </nav>

        <div className="pd2">
          <div className="pd2-gallery-card">
            <div className="pd2-frame">
              <div
                className={cx("pd2-img-wrap", gallery[imageIndex] && "has-hover-zoom", hoverZoomed && "is-hover-zoomed", zoomed && "is-zoomed", gallery.length > 1 && "is-swipeable")}
                tabIndex={gallery[imageIndex] ? 0 : undefined}
                role={gallery.length > 1 ? "group" : undefined}
                aria-roledescription={gallery.length > 1 ? "carousel" : undefined}
                aria-label={gallery[imageIndex] ? `Product photo ${imageIndex + 1} of ${gallery.length}. ${zoomed ? "Photo zoomed in." : "Use the zoom button or double-click to zoom."}` : undefined}
                onPointerDown={handleGalleryPointerDown}
                onPointerMove={handleGalleryPointerMove}
                onPointerUp={handleGalleryPointerUp}
                onPointerCancel={handleGalleryPointerCancel}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") {
                    setGalleryPaused(true);
                    if (!zoomed) setHoverZoomed(true);
                  }
                }}
                onPointerLeave={(event) => {
                  swipeRef.current = null;
                  if (event.pointerType === "mouse") {
                    setGalleryPaused(false);
                    setHoverZoomed(false);
                  }
                }}
                onFocus={() => setGalleryPaused(true)}
                onBlur={() => setGalleryPaused(false)}
                onKeyDown={handleGalleryKeyDown}
                onDoubleClick={toggleZoom}
              >
                {gallery[imageIndex] ? (
                  <Img key={gallery[imageIndex]} src={gallery[imageIndex]} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 600px" />
                ) : (
                  <EmptyState title="No photos yet" text="Photos for this product will appear here." />
                )}
              </div>
              <div className="pd2-tags">
                {preorder && <span className="pd2-tag is-pre">PRE-BOOK</span>}
                {unavailable && <span className="pd2-tag is-out">SOLD OUT</span>}
                {off > 0 && <span className="pd2-tag is-off">-{off}%</span>}
              </div>
              {gallery[imageIndex] && (
                <button
                  type="button"
                  className="pd2-zoom-btn"
                  onClick={toggleZoom}
                  aria-label={zoomed ? "Zoom out of product photo" : "Zoom in on product photo"}
                  aria-pressed={zoomed}
                  title={zoomed ? "Zoom out" : "Zoom in"}
                >
                  {zoomed ? <FiZoomOut aria-hidden="true" /> : <FiZoomIn aria-hidden="true" />}
                </button>
              )}
              {gallery.length > 1 && (
                <span className="pd2-photo-counter" aria-live="polite">
                  {imageIndex + 1} / {gallery.length}
                </span>
              )}
              {gallery.length > 1 && (
                <>
                  <button type="button" className="pd2-main-arrow is-left" onClick={prevImg} aria-label="Previous photo">
                    <FiChevronLeft aria-hidden="true" />
                  </button>
                  <button type="button" className="pd2-main-arrow is-right" onClick={nextImg} aria-label="Next photo">
                    <FiChevronRight aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="pd2-thumbs-wrap">
                <button type="button" className="pd2-arrow is-left" onClick={prevImg} aria-label="Previous photo">
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <div className="pd2-thumbs" role="tablist" aria-label="Product photos">
                  {gallery.slice(0, 10).map((url, i) => (
                    <button key={url} type="button" className={cx(i === imageIndex && "is-active")} onClick={() => selectGalleryImage(i)} aria-label={`Photo ${i + 1}`}>
                      <Img src={url} alt="" fill sizes="120px" />
                    </button>
                  ))}
                </div>
                <button type="button" className="pd2-arrow is-right" onClick={nextImg} aria-label="Next photo">
                  <FiChevronRight aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="pd2-info-card">
            <h1 className="pd2-title">{product.title}</h1>
            {product.sku && (
              <p className="pd2-sku">
                SKU: <strong>{product.sku}</strong>
              </p>
            )}
            {preorder && (
              <p className="pd2-pill is-pre">
                <span className="pd2-pre-icon" aria-hidden="true"><FiClock /></span>
                <span className="pd2-pre-copy">
                  <strong>Pre Order</strong>
                  <span>delivery time will be confirmed after ordering</span>
                </span>
              </p>
            )}
            {unavailable && <p className="pd2-pill is-out">This product is currently sold out</p>}

            <div className="pd2-price">
              {was && <span className="pd2-was num">{formatMoney(was)}</span>}
              <span className="pd2-now num">{formatMoney(current)}</span>
              {off > 0 && <span className="pd2-save">Save {off}%</span>}
            </div>

            {product.shortDescription && <p className="pd2-short">{product.shortDescription}</p>}

            {product.colors.length > 0 && (
              <div className="pd2-block">
                <div className="pd2-label">
                  <span className="req">*</span> Colors:{color && <span className="pd2-chosen">{color.name}</span>}
                </div>
                <div className="pd2-colors">
                  {product.colors.map((c) => (
                    <button
                      key={c.id ?? c.name}
                      type="button"
                      className={cx("pd2-color", colorId === c.id && "is-active")}
                      onClick={() => {
                        setColorId(c.id);
                        setImageIndex(0);
                        setHoverZoomed(false);
                        setZoomed(false);
                        pauseGalleryTemporarily();
                      }}
                      aria-label={`Color ${c.name}`}
                      aria-pressed={colorId === c.id}
                      title={c.name}
                    >
                      {c.image ? (
                        <Img src={c.image} alt="" fill sizes="60px" />
                      ) : (
                        <span className="pd2-color-fill" style={{ background: c.code || "var(--line)" }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasSizes && (
              <div className="pd2-block">
                <div className="pd2-label">
                  <span className="req">*</span>Sizes:
                  <span className="pd2-chosen">
                    {size
                      ? size.stock <= 0 && size.allowPreorder
                        ? `${size.label} · Pre-order`
                        : product.tracked && size.stock <= 5 && size.stock > 0
                          ? `Only ${size.stock} left`
                          : size.label
                      : "Select a size"}
                  </span>
                </div>
                <div className="pd2-sizes" role="radiogroup" aria-label="Size">
                  {product.sizes.map((s) => {
                    const out = s.orderCapacity === 0;
                    return (
                      <button
                        key={s.id ?? s.label}
                        type="button"
                        role="radio"
                        aria-checked={sizeId === s.id}
                        className={cx("pd2-size", sizeId === s.id && "is-active")}
                        disabled={out}
                        onClick={() => setSizeId(s.id)}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pd2-tools">
              <Link href="/size-guide" className="pd2-guide">
                <FaRuler aria-hidden="true" /> Size Guide
              </Link>
              <div className="qty" role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
                  <FiMinus aria-hidden="true" />
                </button>
                <span className="num">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">
                  <FiPlus aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="pd2-cta">
              <button type="button" className="pd2-btn is-add" disabled={unavailable || busy} onClick={() => addToCart("cart")}>
                <FiShoppingCart aria-hidden="true" /> {busy ? "Please wait…" : ctaLabel}
              </button>
              <button type="button" className="pd2-btn is-buy" disabled={unavailable || busy} onClick={() => addToCart("checkout")}>
                <FiShoppingCart aria-hidden="true" /> Buy Now
              </button>
            </div>

                        <div className="pd2-social">
              {messengerUrl ? (
                <a className="pd2-btn is-msg" href={messengerUrl} target="_blank" rel="noopener noreferrer">
                  <FaFacebookMessenger aria-hidden="true" /> Messenger
                </a>
              ) : (
                <button type="button" className="pd2-btn is-msg" onClick={() => toast.info("Messenger chat is coming soon.")}>
                  <FaFacebookMessenger aria-hidden="true" /> Messenger
                </button>
              )}
              {whatsappUrl ? (
                <a className="pd2-btn is-wa" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <FaWhatsapp aria-hidden="true" /> WhatsApp
                </a>
              ) : (
                <button type="button" className="pd2-btn is-wa" onClick={() => toast.info("WhatsApp chat is coming soon.")}>
                  <FaWhatsapp aria-hidden="true" /> WhatsApp
                </button>
              )}
            </div>

            {product.tracked && stockLeft <= 0 && !unavailable && !preorder && (
              <p className="notice notice-warn" style={{ margin: "12px 0 0" }}>
                This product is currently out of stock.
              </p>
            )}

                        <div className="pd2-assure">
              <div className="pd2-assure-item">
                <span className="pd2-assure-icon" aria-hidden="true">
                  <FiTruck />
                </span>
                <span className="pd2-assure-text">
                  <strong>Cash on Delivery</strong>
                  <small>Pay at your doorstep</small>
                </span>
              </div>
              <div className="pd2-assure-item">
                <span className="pd2-assure-icon" aria-hidden="true">
                  <FiPackage />
                </span>
                <span className="pd2-assure-text">
                  <strong>Upfront Delivery Cost</strong>
                  <small>Confirmed at checkout — no hidden fees</small>
                </span>
              </div>
              <div className="pd2-assure-item">
                <span className="pd2-assure-icon" aria-hidden="true">
                  <FiPhoneCall />
                </span>
                <span className="pd2-assure-text">
                  <strong>Order Confirmation</strong>
                  <small>We confirm every order before dispatch</small>
                </span>
              </div>
            </div>

            {product.videoUrl && (
              <a className="pd2-video" href={product.videoUrl} target="_blank" rel="noopener noreferrer">
                <FiPlay aria-hidden="true" /> Watch product video
              </a>
            )}
          </div>
        </div>

        <div className="pd2-lower">
          <div className="tabs" role="tablist">
            {[
              { id: "details", label: "Description" },
              { id: "specs", label: "Specifications" },
              { id: "faq", label: "Questions" },
            ].map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx("tab", tab === t.id && "is-active")} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="anim-fade-in" key={tab}>
            {tab === "details" &&
              (product.description ? (
                <SafeHtml html={product.description} />
              ) : (
                <p className="muted">No description has been added for this product yet.</p>
              ))}

            {tab === "specs" &&
              (product.specifications.length > 0 ? (
                <AlignedTable className="spec-table">
                  <tbody>
                    {product.specifications.map((spec, i) => (
                      <tr key={`${spec.key}-${i}`}>
                        <th scope="row">{spec.key}</th>
                        <td>{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </AlignedTable>
              ) : (
                <p className="muted">No specifications listed.</p>
              ))}

            {tab === "faq" &&
              (product.faqs.length > 0 ? (
                <div className="faq">
                  {product.faqs.map((faq, i) => (
                    <details key={faq.id ?? i}>
                      <summary>{faq.question}</summary>
                      <p>{faq.answer}</p>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="muted">No questions have been published for this product.</p>
              ))}
          </div>
        </div>

        {related.length > 0 && (
          <section className="pd2-related">
            <div className="section-head">
              <div>
                <p className="eyebrow">You may also like</p>
                <h2>More from {category?.name || "this collection"}</h2>
              </div>
            </div>
            <div className="product-grid is-compact stagger">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
