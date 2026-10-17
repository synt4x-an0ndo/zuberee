"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { FiShoppingBag, FiShoppingCart, FiX } from "react-icons/fi";
import { cx } from "@/components/ui";
import Img from "@/components/Img";
import { useCart } from "@/context/CartContext";
import { useFeedback } from "@/context/FeedbackContext";
import { formatMoney } from "@/lib/api";
import { normalizeProduct } from "@/lib/format";

const AVAILABILITY = {
  "in-stock": { label: "IN-STOCK", tone: "solid" },
  "pre-order": { label: "Pre-order", tone: "info" },
  "sold-out": { label: "Sold out", tone: "neutral" },
};

export default function ProductCard({ product: raw, index = 0 }) {
  const product = raw?.images !== undefined && raw?.hasSale !== undefined ? raw : normalizeProduct(raw);
  const defaultColorId = product?.colors?.[0]?.id ?? null;
  const router = useRouter();
  const { addItem, closeDrawer } = useCart();
  const { toast } = useFeedback();
  const [quickOpen, setQuickOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState(defaultColorId);
  const [selectedSizeId, setSelectedSizeId] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [failedImages, setFailedImages] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [hoveringCard, setHoveringCard] = useState(false);
  const cardRef = useRef(null);
  const cardRect = useRef(null);

  // Feeds --card-mx/--card-my so the CSS spotlight follows the pointer.
  const trackCardPointer = (event) => {
    const node = cardRef.current;
    if (!node) return;
    if (!cardRect.current) cardRect.current = node.getBoundingClientRect();
    const rect = cardRect.current;
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    node.style.setProperty("--card-mx", `${x.toFixed(2)}%`);
    node.style.setProperty("--card-my", `${y.toFixed(2)}%`);
  };

  const resetCardRect = () => {
    cardRect.current = null;
  };

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    setSelectedColorId(defaultColorId);
    setSelectedSizeId(null);
    setQuickOpen(false);
    setFailedImages([]);
    setActiveImage(0);
    setHoveringCard(false);
  }, [product?.id, defaultColorId]);

  // Gallery walk: while the card is hovered, step through every usable
  // photo so all of them are seen, not just the first two. The first step
  // lands on the second photo immediately, which is what the card already
  // did on hover. Uses mouseenter/mouseleave (not pointer events) so touch
  // devices are untouched - they never fire these.
  useEffect(() => {
    if (!hoveringCard) return undefined;
    const total = Array.isArray(product?.images)
      ? product.images.filter((item) => item.url && !failedImages.includes(item.url)).length
      : 0;
    if (total < 2) return undefined;
    setActiveImage(1 % total);
    const timer = window.setInterval(() => {
      setActiveImage((current) => (current + 1) % total);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [hoveringCard, failedImages, product?.id]);
  useEffect(() => {
    if (!quickOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => event.key === "Escape" && setQuickOpen(false);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [quickOpen]);

  if (!product) return null;

  const status = AVAILABILITY[product.availability];
  const swatches = product.colors.filter((color) => color.code).slice(0, 5);
  const extraColors = Math.max(0, product.colors.length - swatches.length);
  // Gallery fallback: the backend can reference files that are no longer on
  // disk, so drop any image that has failed and use what is left. images[0]
  // becomes the resting photo and images[1] the hover photo, exactly as
  // before - we just skip the dead ones instead of showing a broken image.
  const usableImages = product.images.filter((item) => item.url && !failedImages.includes(item.url));
  const galleryCount = usableImages.length;
  // clamp defensively: photos can drop out of the gallery after a 404
  const activeIndex = galleryCount ? ((activeImage % galleryCount) + galleryCount) % galleryCount : 0;
  const primaryImage = usableImages[0]?.url || null;
  const markImageFailed = (url) => {
    if (!url) return;
    setFailedImages((current) => (current.includes(url) ? current : [...current, url]));
  };
  const unavailable = product.availability === "sold-out";
  const needsOptions = product.sizes.length > 0 || product.colors.length > 1;
  const selectedSize = product.sizes.find((size) => String(size.id) === String(selectedSizeId)) || null;
  const sizePrice = selectedSize && selectedSize.price !== null && selectedSize.price !== product.price
    ? selectedSize.price
    : product.salePrice;
  const canPurchase = !unavailable && (!product.sizes.length || Boolean(selectedSize)) &&
    !(product.tracked && selectedSize && selectedSize.stock <= 0) && !busyAction;

  const runAction = async (intent) => {
    if (unavailable || busyAction) return;
    if (product.sizes.length > 0 && !selectedSize) {
      setQuickOpen(true);
      toast.info("Choose a size to continue.");
      return;
    }
    if (product.tracked && selectedSize && selectedSize.stock <= 0) {
      toast.error("That size is out of stock. Please choose another size.");
      return;
    }

    setBusyAction(intent);
    try {
      await addItem({
        productId: product.id,
        variantId: selectedSize?.id ?? null,
        colorId: selectedColorId ?? null,
        quantity: 1,
      });
      setQuickOpen(false);
      if (intent === "buy") {
        closeDrawer();
        router.push("/checkout");
      } else {
        toast.success(`${product.title} added to your cart`);
      }
    } catch (error) {
      toast.error(error?.message || "Could not add this product to your cart.");
    } finally {
      setBusyAction("");
    }
  };

  const openQuickAction = (intent) => {
    if (unavailable || busyAction) return;
    if (needsOptions) {
      setQuickOpen(true);
      return;
    }
    runAction(intent);
  };

  const quickDialog = quickOpen && portalReady
    ? createPortal(
        <div className="quick-add-overlay" onMouseDown={(event) => event.target === event.currentTarget && setQuickOpen(false)}>
          <section className="quick-add-dialog anim-scale-in" role="dialog" aria-modal="true" aria-labelledby={`quick-add-title-${product.id}`}>
            <div className="quick-add-head">
              <h2 id={`quick-add-title-${product.id}`}>Choose options</h2>
              <button type="button" className="icon-btn" onClick={() => setQuickOpen(false)} aria-label="Close quick add">
                <FiX aria-hidden="true" />
              </button>
            </div>

            <div className="quick-add-product">
              <div className="quick-add-thumb">
                {primaryImage && <Img src={primaryImage} alt="" fill sizes="72px" />}
              </div>
              <div className="quick-add-product-copy">
                <h3>{product.title}</h3>
                <span className="price-now">{formatMoney(sizePrice)}</span>
              </div>
            </div>

            {product.colors.length > 0 && (
              <div className="quick-add-option">
                <div className="quick-add-option-label">
                  <strong>Color</strong>
                  <span>{product.colors.find((color) => String(color.id) === String(selectedColorId))?.name || product.colors[0]?.name}</span>
                </div>
                <div className="quick-add-colors">
                  {product.colors.map((color, colorIndex) => (
                    <button
                      key={color.id ?? `${color.name}-${colorIndex}`}
                      type="button"
                      className={cx("quick-add-color", String(selectedColorId) === String(color.id) && "is-active")}
                      onClick={() => setSelectedColorId(color.id)}
                      aria-label={`Choose ${color.name}`}
                      aria-pressed={String(selectedColorId) === String(color.id)}
                      title={color.name}
                    >
                      <span style={{ background: color.code || "#e5e7eb" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes.length > 0 && (
              <div className="quick-add-option">
                <div className="quick-add-option-label">
                  <strong>Size</strong>
                  <span>{selectedSize?.label || "Select a size"}</span>
                </div>
                <div className="quick-add-sizes">
                  {product.sizes.map((size) => {
                    const soldOut = product.tracked && size.stock <= 0;
                    return (
                      <button
                        key={size.id ?? size.label}
                        type="button"
                        className={cx("quick-add-size", String(selectedSizeId) === String(size.id) && "is-active")}
                        onClick={() => setSelectedSizeId(size.id)}
                        disabled={soldOut}
                        aria-pressed={String(selectedSizeId) === String(size.id)}
                        title={soldOut ? "Out of stock" : size.label}
                      >
                        {size.label || "Size"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="quick-add-actions">
              <button type="button" className="quick-add-dialog-btn is-secondary" onClick={() => runAction("add")} disabled={!canPurchase}>
                {busyAction === "add" ? "Adding…" : "Add to Cart"}
              </button>
              <button type="button" className="quick-add-dialog-btn is-primary" onClick={() => runAction("buy")} disabled={!canPurchase}>
                {busyAction === "buy" ? "Opening checkout…" : "Buy Now"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <article
        ref={cardRef}
        className="product-card anim-fade-up"
        style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        onPointerEnter={resetCardRect}
        onPointerMove={trackCardPointer}
        onPointerLeave={resetCardRect}
        onMouseEnter={() => setHoveringCard(true)}
        onMouseLeave={() => {
          setHoveringCard(false);
          setActiveImage(0);
        }}
      >
        <div className="product-card-visual">
          <Link href={`/product-page/${product.id}`} className="product-media" aria-label={product.title}>
            {galleryCount > 0 ? (
              usableImages.map((item, imageIndex) => (
                <Img
                  key={item.url}
                  src={item.url}
                  alt={imageIndex === 0 ? product.title : ""}
                  fill
                  sizes="(max-width: 760px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className={cx("stack-img", activeIndex === imageIndex && "is-active")}
                  onError={() => markImageFailed(item.url)}
                />
              ))
            ) : (
              <span className="no-image">No image</span>
            )}
          </Link>

          <div className="product-tags">
            {status && <span className={cx("badge", `badge-${status.tone}`)}>{status.label}</span>}
          </div>

          <div className="product-card-actions" aria-label={`Quick actions for ${product.title}`}>
            <button
              type="button"
              className="product-card-action is-buy"
              onClick={() => openQuickAction("buy")}
              disabled={unavailable || Boolean(busyAction)}
              aria-label={`Buy ${product.title} now`}
              title={`Buy ${product.title} now`}
            >
              <FiShoppingBag aria-hidden="true" />
            </button>
            <button
              type="button"
              className="product-card-action is-cart"
              onClick={() => openQuickAction("add")}
              disabled={unavailable || Boolean(busyAction)}
              aria-label={`Add ${product.title} to cart`}
              title={`Add ${product.title} to cart`}
            >
              <FiShoppingCart aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="product-body">
          <h3 className="product-title">
            <Link href={`/product-page/${product.id}`}>{product.title}</Link>
          </h3>
          <div className="price">
            <span className="price-now">{formatMoney(product.salePrice)}</span>
            {product.hasSale && <span className="price-was">{formatMoney(product.price)}</span>}
          </div>
          {swatches.length > 0 && (
            <div className="swatches" aria-label="Available colors">
              {swatches.map((color, colorIndex) => (
                <span key={`${color.name}-${colorIndex}`} className="swatch" style={{ background: color.code }} title={color.name} />
              ))}
              {extraColors > 0 && <span className="swatch-more">+{extraColors}</span>}
            </div>
          )}
        </div>
      </article>
      {quickDialog}
    </>
  );
}
