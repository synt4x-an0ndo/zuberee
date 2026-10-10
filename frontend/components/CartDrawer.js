"use client";

import { useEffect, useRef, useState } from "react";
import { FaMinus, FaPlus, FaTrash, FaXmark as FaTimes, FaArrowLeft, FaBagShopping as FaShoppingBag } from "react-icons/fa6";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatTk, imgUrl, API_BASE } from "@/lib/api";
import { DISTRICTS } from "@/lib/districts";
import notify from "@/components/notify";

/**
 * Slide-in cart + checkout drawer (same flow as the original site):
 *  - cart tab: qty steppers, remove, subtotal
 *  - checkout tab: name / phone / district / address / COD
 *  - shipping quote:  GET  api/shipping-costs-latest
 *  - place order:     POST api/orders
 *  - abandoned-cart:  POST api/track-abandoned-checkout   (X-Session-ID)
 *  - conversion:      POST api/mark-checkout-converted
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
    delivery_notes: "",
  });
  const [shipping, setShipping] = useState(0);
  const [placing, setPlacing] = useState(false);
  const trackedOnce = useRef(false);

  const grand = total + shipping;

  const sessionId = () => {
    let s = sessionStorage.getItem("checkout_session_id");
    if (!s) {
      s = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("checkout_session_id", s);
    }
    return s;
  };

  /* Shipping quote when district changes (same rule as original) */
  useEffect(() => {
    if (!form.district) return;
    let alive = true;
    (async () => {
      try {
        const r = await api.get("api/shipping-costs-latest", { auth: false });
        const data = r?.data || r;
        if (!alive) return;
        const cost =
          form.district === "dhaka"
            ? data.inside_dhaka || data.one_shipping_cost || 0
            : data.outside_dhaka || data.one_shipping_cost || 0;
        setShipping(Number(cost) || 0);
      } catch {
        if (alive) setShipping(0);
      }
    })();
    return () => {
      alive = false;
    };
  }, [form.district]);

  /* "Buy Now" -> open drawer on the checkout tab */
  useEffect(() => {
    if (checkoutSignal > 0) setTab("checkout");
  }, [checkoutSignal]);

  /* Abandoned checkout tracking (fire & forget, once per drawer session) */
  const trackAbandoned = async () => {
    if (trackedOnce.current) return;
    if (!form.phone || items.length === 0) return;
    trackedOnce.current = true;
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        address: form.address,
        cart_items: items,
      };
      await fetch(`${API_BASE}/api/track-abandoned-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId(),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      /* tracking must never block checkout */
    }
  };

  useEffect(() => {
    if (!open) return;
    trackedOnce.current = false;
    const onLeave = () => trackAbandoned();
    window.addEventListener("beforeunload", onLeave);
    const onVis = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    document.addEventListener("visibilitychange", onVis);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      document.body.style.overflow = "unset";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, items, form.phone]);

  useEffect(() => {
    if (open && tab === "checkout" && form.phone) {
      const t = setTimeout(trackAbandoned, 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, form.phone]);

  if (!open) return null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const placeOrder = async (e) => {
    e.preventDefault();
    if (placing) return;
    if (items.length === 0) {
      notify.error("Your cart is empty. Please add items before checking out.");
      return;
    }
    setPlacing(true);
    const cookieVal = (name) =>
      (document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)) || [])[1] || null;

    const body = {
      shippingFee: Number(shipping) || 0,
      ...(isAuthenticated
        ? { shippingAddress: [form.address, form.district].filter(Boolean).join(", ") }
        : {
          guestName: form.name,
          guestPhone: form.phone,
          guestAddress: [form.address, form.district].filter(Boolean).join(", "),
        }),
    };
    try {
      if (form.phone) {
        try {
          await api.post("api/mark-checkout-converted", {
            session_id: sessionId(),
            phone: form.phone,
          });
        } catch {
          /* non-critical */
        }
      }
      await api.post("api/orders", body);
      await refreshCart();
      notify.success("Order Placed! Thank you for your purchase.");
      setForm({
        name: "",
        phone: "",
        address: "",
        district: "",
        payment_method: "cash",
        delivery_notes: "",
      });
      setShipping(0);
      setTab("cart");
      closeCart();
    } catch (err) {
      const shortfalls = err?.data?.shortfalls;
      if (Array.isArray(shortfalls) && shortfalls.length) {
        notify.error(shortfalls.map((s) => s.message || s).join("\n"));
      } else {
        notify.error(err.message || "Failed to place order");
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <div
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{ background: "rgba(0,0,0,.5)", zIndex: 1050 }}
        onClick={closeCart}
      />
      <aside
        className="position-fixed top-0 end-0 h-100 bg-white d-flex flex-column"
        style={{ width: "min(430px, 92vw)", zIndex: 1060, boxShadow: "-6px 0 24px rgba(0,0,0,.15)" }}
      >
        {/* header */}
        <div className="cart-drawer-header d-flex align-items-center justify-content-between border-bottom">
          <h5 className="mb-0 fw-bold">
            {tab === "cart" ? (
              <>
                <FaShoppingBag className="me-2" style={{ color: "var(--primary-color)" }} />
                Cart
              </>
            ) : (
              <>
                <FaArrowLeft
                  className="me-2"
                  style={{ cursor: "pointer", color: "var(--primary-color)" }}
                  onClick={() => setTab("cart")}
                />
                Checkout
              </>
            )}
          </h5>
          <button className="border-0 bg-transparent" onClick={closeCart} aria-label="Close cart">
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
                <button className="btn btn-outline-secondary btn-sm" onClick={() => refreshCart().catch(() => {})}>
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
                          className="cart-minus border bg-white rounded-circle"
                          style={{ width: 24, height: 24 }}
                          onClick={() => dec(it.lineId)}
                        >
                          <FaMinus size={10} />
                        </button>
                        <span className="small fw-semibold">{it.qty}</span>
                        <button
                          className="cart-plus border bg-white rounded-circle"
                          style={{ width: 24, height: 24 }}
                          onClick={() => inc(it.lineId)}
                        >
                          <FaPlus size={10} />
                        </button>
                        <button
                          className="border-0 bg-transparent text-danger ms-1"
                          onClick={() => removeItem(it.lineId)}
                          aria-label="Remove"
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
                <label className="form-label small fw-semibold">👤 Full Name</label>
                <input
                  className="form-control"
                  required={!isAuthenticated}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">📞 Phone Number</label>
                <input
                  className="form-control"
                  required={!isAuthenticated}
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">📍 District</label>
                <select
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
                <label className="form-label small fw-semibold">
                  🏠 Full Address <span className="text-muted">(Required)</span>
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  required
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="House, road, area..."
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">🚚 Delivery Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.delivery_notes}
                  onChange={(e) => setField("delivery_notes", e.target.value)}
                  placeholder="Any instructions for delivery..."
                />
              </div>

              <div className="border rounded p-3 mb-3 bg-light">
                <div className="d-flex justify-content-between small mb-1">
                  <span>Subtotal:</span>
                  <span className="fw-semibold">{formatTk(total)}৳</span>
                </div>
                <div className="d-flex justify-content-between small mb-1">
                  <span>Shipping:</span>
                  <span className="fw-semibold">
                    {form.district ? `${formatTk(shipping)}৳` : "Calculated at checkout"}
                  </span>
                </div>
                <hr className="my-2" />
                <div className="d-flex justify-content-between">
                  <span className="fw-bold">Total Amount:</span>
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
