"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlay, FiPlus, FiRotateCcw, FiShield, FiTruck } from "react-icons/fi";
import Img from "@/components/Img";
import ProductCard from "@/components/ProductCard";
import SafeHtml from "@/components/SafeHtml";
import { Button, cx, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { useFeedback } from "@/context/FeedbackContext";
import { useSite } from "@/context/SiteContext";
import { api, formatMoney, listOf, unwrap } from "@/lib/api";
import { discountPercent, normalizeProduct } from "@/lib/format";

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
  const { categories } = useSite();
  const { addItem } = useCart();
  const { toast } = useFeedback();

  const [state, setState] = useState({ loading: true, error: "", product: null });
  const [related, setRelated] = useState([]);
  const [imageIndex, setImageIndex] = useState(0);
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
  const maxQty = product.tracked && size ? Math.max(1, size.stock) : 99;

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

  const ctaLabel = unavailable ? "Sold out" : preorder ? "Pre-order now" : "Add to cart";

  return (
    <div className="container section" style={{ paddingTop: "1.5rem" }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        {category && <Link href={`/${category.slug}`}>{category.name}</Link>}
        {category && <span>/</span>}
        <span style={{ color: "var(--ink-2)" }}>{product.title}</span>
      </nav>

      <div className="pdp">
        <div>
          <div className="gallery-main">
            {gallery[imageIndex] ? (
              <Img key={gallery[imageIndex]} src={gallery[imageIndex]} alt={product.title} fill priority sizes="(max-width: 1024px) 100vw, 600px" />
            ) : (
              <EmptyState title="No photos yet" text="Photos for this product will appear here." />
            )}
            <div className="product-tags" style={{ top: "1rem", left: "1rem" }}>
              {off > 0 && <span className="badge badge-solid">-{off}%</span>}
              {preorder && <span className="badge badge-info">Pre-order</span>}
              {unavailable && <span className="badge badge-neutral">Sold out</span>}
            </div>
          </div>
          {gallery.length > 1 && (
            <div className="gallery-thumbs" role="tablist" aria-label="Product photos">
              {gallery.slice(0, 10).map((url, i) => (
                <button key={url} type="button" className={cx(i === imageIndex && "is-active")} onClick={() => setImageIndex(i)} aria-label={`Photo ${i + 1}`}>
                  <Img src={url} alt="" fill sizes="120px" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pdp-info">
          <div>
            {product.sku && <p className="muted num" style={{ fontSize: "0.84rem" }}>SKU {product.sku}</p>}
            <h1 style={{ marginTop: "0.25rem" }}>{product.title}</h1>
          </div>

          <div className="price price-lg">
            <span className="price-now num">{formatMoney(current)}</span>
            {was && <span className="price-was num">{formatMoney(was)}</span>}
            {off > 0 && <span className="price-off">Save {off}%</span>}
          </div>

          {product.shortDescription && <p style={{ color: "var(--ink-2)" }}>{product.shortDescription}</p>}

          {product.colors.length > 0 && (
            <div>
              <div className="option-label">
                Color <span>{color?.name}</span>
              </div>
              <div className="swatch-row">
                {product.colors.map((c) => (
                  <button
                    key={c.id ?? c.name}
                    type="button"
                    className={cx("swatch swatch-lg", colorId === c.id && "is-active")}
                    style={{ background: c.code || "var(--line)" }}
                    onClick={() => {
                      setColorId(c.id);
                      setImageIndex(0);
                    }}
                    aria-label={`Color ${c.name}`}
                    aria-pressed={colorId === c.id}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          {hasSizes && (
            <div>
              <div className="option-label">
                Size <span>{size ? (product.tracked && size.stock <= 5 && size.stock > 0 ? `Only ${size.stock} left` : "") : "Select a size"}</span>
              </div>
              <div className="size-row" role="radiogroup" aria-label="Size">
                {product.sizes.map((s) => {
                  const out = product.tracked && s.stock <= 0;
                  return (
                    <button
                      key={s.id ?? s.label}
                      type="button"
                      role="radio"
                      aria-checked={sizeId === s.id}
                      className={cx("size-btn", sizeId === s.id && "is-active")}
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

          <div className="buy-row">
            <div className="qty" role="group" aria-label="Quantity">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
                <FiMinus aria-hidden="true" />
              </button>
              <span className="num">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">
                <FiPlus aria-hidden="true" />
              </button>
            </div>
            <Button size="lg" variant="primary" loading={busy} disabled={unavailable || busy} onClick={() => addToCart("cart")} className="grow">
              {ctaLabel}
            </Button>
          </div>
          <div className="row">
            <Button variant="outline" block disabled={unavailable || busy} onClick={() => addToCart("checkout")}>
              Buy now
            </Button>
          </div>
          {product.tracked && stockLeft <= 0 && !unavailable && <p className="notice notice-warn" style={{ margin: 0 }}>This product is currently out of stock.</p>}

          <ul className="trust-list">
            <li><FiTruck aria-hidden="true" /> Cash on delivery available</li>
            <li><FiRotateCcw aria-hidden="true" /> Delivery charges are confirmed at checkout</li>
            <li><FiShield aria-hidden="true" /> Orders are confirmed before dispatch</li>
          </ul>

          {product.videoUrl && (
            <a className="btn btn-outline" href={product.videoUrl} target="_blank" rel="noopener noreferrer">
              <FiPlay aria-hidden="true" /> Watch product video
            </a>
          )}
        </div>
      </div>

      <div style={{ marginTop: "3rem" }}>
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
              <table className="spec-table">
                <tbody>
                  {product.specifications.map((spec, i) => (
                    <tr key={`${spec.key}-${i}`}>
                      <th scope="row">{spec.key}</th>
                      <td>{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <section style={{ marginTop: "3.5rem" }}>
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
  );
}
