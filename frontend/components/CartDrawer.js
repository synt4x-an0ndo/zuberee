"use client";

import { useEffect, useRef, useState } from "react";
import { FaMinus, FaPlus, FaTrash, FaXmark as FaTimes, FaArrowLeft, FaBagShopping as FaShoppingBag } from "react-icons/fa6";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatTk, imgUrl } from "@/lib/api";
import { DISTRICTS } from "@/lib/districts";
import notify from "@/components/notify";

/**
 * Slide-in cart + checkout drawer (same flow as the original site):
 *  - cart tab: qty steppers, remove, subtotal
 *  - checkout tab: name / phone / district / address / COD
 *  - place order:     POST api/orders
 */
export default function CartDrawer() {
  const {
    items,
    total,
    open,
    closeCart,
    inc,
    dec,
    removeItem,
    checkoutSignal,
    loading: cartLoading,
    error: cartError,
    refreshCart,
  } = useCart();
  const { isAuthenticated } = useAuth();

  const [tab, setTab] = useState("cart");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    district: "",
    payment_method: "cash",
  });
  const [shipping, setShipping] = useState(0);
  const [shippingStatus, setShippingStatus] = useState("idle");
  const [placing, setPlacing] = useState(false);
  const closeButtonRef = useRef(null);

  const grand = total + shipping;

  /* Shipping quotes are unavailable until the backend endpoint is provided. */
  useEffect(() => {
    if (!form.district) {
      setShipping(0);
      setShippingStatus("idle");
      return undefined;
    }
    setShipping(0);
    setShippingStatus("unavailable");
    return undefined;
  }, [form.district]);

  /* "Buy Now" -> open drawer on the checkout tab */
  useEffect(() => {
    if (checkoutSignal > 0) setTab("checkout");
  }, [checkoutSignal]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeCart]);

  if (!open) return null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const placeOrder = async (e) => {
    e.preventDefault();
    if (placing) return;
    if (items.length === 0) {
      notify.error("Your cart is empty. Please add items before checking out.", "Empty Cart");
      return;
    }
    setPlacing(true);

    const body = {
      shippingFee: shippingStatus === "ready" ? Number(shipping) || 0 : 0,
      ...(isAuthenticated
        ? { shippingAddress: [form.address, form.district].filter(Boolean).join(", ") }
        : {
          guestName: form.name,
          guestPhone: form.phone,
          guestAddress: [form.address, form.district].filter(Boolean).join(", "),
        }),
    };
    try {
      await api.post("api/orders", body);
      try {
        await refreshCart();
      } catch {
        // The order has succeeded; a failed cart refresh must not report failure.
      }
      notify.success(
        shippingStatus === "unavailable"
          ? "Order placed. The store will confirm delivery charges with you."
          : "Thank you for your purchase.",
        "Order placed!"
      );
      setForm({
        name: "",
        phone: "",
        address: "",
        district: "",
        payment_method: "cash",
      });
      setShipping(0);
      setTab("cart");
      closeCart();
    } catch (err) {
      const shortfalls = err?.data?.shortfalls;
      if (Array.isArray(shortfalls) && shortfalls.length) {
        const details = shortfalls.map((item) => {
          if (typeof item === "string") return item;
          const label = [item.title, item.variant_label].filter(Boolean).join(" — ");
          return `${label || "An item"}: ${item.message || `${item.available ?? 0} available`}`;
        });
        notify.error(details.join("\n"), "Order failed");
      } else {
        notify.error(err.message || "Failed to place order", "Order Failed");
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <div
        className="cart-drawer-overlay position-fixed top-0 start-0 w-100 h-100"
        aria-hidden="true"
        onClick={closeCart}
      />
      <aside
        className="cart-drawer cart-drawer-panel position-fixed top-0 end-0 h-100 bg-white d-flex flex-column"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
      >
        {/* header */}
        <div className="cart-drawer-header d-flex align-items-center justify-content-between border-bottom">
          <div className="d-flex align-items-center gap-2">
            {tab === "checkout" && (
              <button type="button" className="cart-back-button" onClick={() => setTab("cart")} aria-label="Back to cart">
                <FaArrowLeft />
              </button>
            )}
            <h2 id="cart-drawer-title" className="h5 mb-0 fw-bold">
              {tab === "cart" ? <><FaShoppingBag className="me-2" aria-hidden="true" />Cart</> : "Checkout"}
            </h2>
          </div>
          <button ref={closeButtonRef} type="button" className="cart-close-button" onClick={closeCart} aria-label="Close cart">
            <FaTimes size={18} />
          </button>
        </div>

        {/* body */}
        <div className="cart-drawer-content flex-fill overflow-auto">
          {tab === "cart" ? (
            cartLoading ? (
              <div className="text-center py-5 text-muted">
                <span className="spinner-border spinner-border-sm me-2" />
                Loading your cart...
              </div>
            ) : cartError ? (
              <div className="text-center py-5 px-3">
                <p className="text-danger small">{cartError}</p>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => refreshCart().catch(() => { })}>
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-5 px-3">
                <FaShoppingBag size={44} className="text-muted mb-3" />
                <h6 className="fw-bold">Your cart is empty</h6>
                <p className="text-muted small">Add some amazing products to get started</p>
                <button className="btn btn-grad px-4 py-2 fw-semibold" onClick={closeCart}>
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="cart-items-container">
                <div className="d-flex fw-semibold small text-muted border-bottom pb-2 mb-1">
                  <div className="flex-fill">Product</div>
                  <div>Total</div>
                </div>
                {items.map((it) => (
                  <div key={it.lineId} className="cart-item d-grid align-items-center border-bottom">
                    <img
                      src={imgUrl(it.colorImage || it.image)}
                      alt=""
                      width={60}
                      height={60}
                      style={{ objectFit: "cover", borderRadius: 6, background: "#f6f6f6" }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="small fw-semibold text-truncate" title={it.title}>
                        {it.title}
                      </div>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {it.size_label ? `Size: ${it.size_label}` : ""}
                        {it.color_name ? ` ${it.size_label ? "•" : ""} ${it.color_name}` : ""}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <button
                          type="button"
                          className="cart-minus border bg-white rounded-circle"
                          aria-label={`Decrease quantity of ${it.title}`}
                          style={{ width: 24, height: 24 }}
                          onClick={() => dec(it.lineId)}
                        >
                          <FaMinus size={10} />
                        </button>
                        <span className="small fw-semibold">{it.qty}</span>
                        <button
                          type="button"
                          className="cart-plus border bg-white rounded-circle"
                          aria-label={`Increase quantity of ${it.title}`}
                          style={{ width: 24, height: 24 }}
                          onClick={() => inc(it.lineId)}
                        >
                          <FaPlus size={10} />
                        </button>
                        <button
                          type="button"
                          className="cart-remove-button border-0 bg-transparent text-danger ms-1"
                          onClick={() => removeItem(it.lineId)}
                          aria-label={`Remove ${it.title} from cart`}
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="fw-bold small" style={{ color: "var(--primary-color)" }}>
                      {formatTk(it.totalPrice ?? it.unitPrice * it.qty)}৳
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form className="checkout-form" onSubmit={placeOrder}>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="checkout-name">Full name</label>
                <input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  className="form-control"
                  required={!isAuthenticated}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="checkout-phone">Phone number</label>
                <input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  className="form-control"
                  required={!isAuthenticated}
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="checkout-district">District</label>
                <select
                  id="checkout-district"
                  name="district"
                  className="form-select"
                  required
                  value={form.district}
                  onChange={(e) => setField("district", e.target.value)}
                >
                  <option value="">Search or select district...</option>
                  {DISTRICTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold" htmlFor="checkout-address">
                  Full delivery address <span className="text-muted">(required)</span>
                </label>
                <textarea
                  id="checkout-address"
                  name="address"
                  autoComplete="street-address"
                  className="form-control"
                  rows={3}
                  required
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="House, road, area..."
                />
              </div>
              <div className="border rounded p-3 mb-3 bg-light">
                <div className="d-flex justify-content-between small mb-1">
                  <span>Items subtotal:</span>
                  <span className="fw-semibold">{formatTk(total)}৳</span>
                </div>
                <div className="d-flex justify-content-between small mb-1">
                  <span>Delivery fee:</span>
                  <span className="fw-semibold">
                    {shippingStatus === "ready"
                      ? `${formatTk(shipping)}৳`
                      : shippingStatus === "loading"
                        ? "Checking…"
                        : shippingStatus === "unavailable"
                          ? "To be confirmed"
                          : "Select a district"}
                  </span>
                </div>
                {shippingStatus === "unavailable" && (
                  <p className="cart-shipping-note" role="status">
                    Delivery fees could not be retrieved. The store will confirm the charge with you before fulfillment.
                  </p>
                )}
                <hr className="my-2" />
                <div className="d-flex justify-content-between">
                  <span className="fw-bold">{shippingStatus === "ready" ? "Total amount:" : "Items total:"}</span>
                  <span className="fw-bold" style={{ color: "var(--primary-color)" }}>
                    {formatTk(grand)}৳
                  </span>
                </div>
              </div>

              <div className="border rounded p-3 mb-3 d-flex align-items-center gap-2">
                <input
                  type="radio"
                  name="pay"
                  checked
                  readOnly
                  id="cod"
                />
                <label htmlFor="cod" className="mb-0">
                  <div className="fw-semibold small">💳 Cash on Delivery</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    Pay when you receive your order
                  </div>
                </label>
              </div>

              <button className="btn btn-grad w-100 py-2 fw-semibold" disabled={placing}>
                {placing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Placing Order...
                  </>
                ) : (
                  "📦 Place Order"
                )}
              </button>
            </form>
          )}
        </div>

        {/* footer */}
        {tab === "cart" && items.length > 0 && (
          <div className="border-top p-3">
            <div className="d-flex justify-content-between mb-2">
              <span className="fw-semibold">Subtotal:</span>
              <span className="fw-bold" style={{ color: "var(--primary-color)" }}>
                {formatTk(total)}৳
              </span>
            </div>
            <div className="text-muted small mb-2">
              Shipping: {form.district ? `${formatTk(shipping)}৳` : "Calculated at checkout"}
            </div>
            <button
              className="btn btn-grad w-100 py-2 fw-semibold"
              onClick={() => setTab("checkout")}
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
