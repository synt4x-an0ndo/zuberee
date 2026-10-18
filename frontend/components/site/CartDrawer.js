"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiMinus, FiPlus, FiShoppingBag, FiTrash2, FiX } from "react-icons/fi";
import Img from "@/components/Img";
import { Button, Spinner } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { useFeedback } from "@/context/FeedbackContext";
import { formatMoney } from "@/lib/api";

export default function CartDrawer() {
    const { cart, drawerOpen, closeDrawer, updateItem, removeItem, clearCart, loading } = useCart();
  const { toast, confirm } = useFeedback();
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  const change = async (item, next) => {
    try {
      await updateItem(item.id, next);
      toast.success(`${item.title} quantity updated.`);
    } catch (error) {
      toast.error(error.message);
    }
  };

    const clearAll = async () => {
    const ok = await confirm({
      title: "Clear your cart?",
      message: "Every item will be removed from your cart.",
      confirmText: "Clear all",
      danger: true,
    });
    if (!ok) return;
    setClearing(true);
    try {
      await clearCart();
      toast.success("Cart cleared.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setClearing(false);
    }
  };

  const remove = async (item) => {
    try {
      await removeItem(item.id);
      toast.info(`Removed ${item.title}`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeDrawer()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="drawer-head">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800 }}>
            Your cart <span className="muted">({cart.totalItems})</span>
          </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {cart.items.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: "#b3261e" }}
                onClick={clearAll}
                disabled={clearing}
              >
                <FiTrash2 aria-hidden="true" /> {clearing ? "Clearing…" : "Clear all"}
              </button>
            )}
            <button type="button" className="icon-btn" onClick={closeDrawer} aria-label="Close cart">
              <FiX aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {loading && cart.items.length === 0 ? (
            <div className="row" style={{ padding: "2rem 0", justifyContent: "center" }}>
              <Spinner />
            </div>
          ) : cart.items.length === 0 ? (
            <div className="empty" style={{ margin: "2rem 0", border: 0 }}>
              <span className="empty-icon"><FiShoppingBag aria-hidden="true" /></span>
              <h3>Your cart is empty</h3>
              <p>Browse the latest arrivals and add something you like.</p>
              <Button href="/shop" onClick={closeDrawer}>Start shopping</Button>
            </div>
          ) : (
            cart.items.map((item) => (
              <div className="cart-line" key={item.id}>
                <div className="thumb-wrap" style={{ width: 74, height: 92 }}>
                  {item.image ? (
                    <Img src={item.image} alt={item.title} fill />
                  ) : (
                    <span className="skeleton" style={{ width: "100%", height: "100%" }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</h3>
                  <div className="meta">
                    {item.variant?.label && <span>Size {item.variant.label}</span>}
                    {item.isPreorder && <span>Pre-order</span>}
                    {item.color && <span>{item.color.name}</span>}
                    <span className="num">{formatMoney(item.unitPrice)}</span>
                  </div>
                  <div className="line-actions">
                    <div className="qty">
                      <button type="button" onClick={() => change(item, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity">
                        <FiMinus aria-hidden="true" />
                      </button>
                      <span className="num">{item.quantity}</span>
                      <button type="button" onClick={() => change(item, item.quantity + 1)} disabled={item.maxQuantity !== null && item.maxQuantity !== undefined && item.quantity >= item.maxQuantity} aria-label="Increase quantity">
                        <FiPlus aria-hidden="true" />
                      </button>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(item)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="drawer-foot">
            <div className="summary-row total" style={{ margin: 0, border: 0, padding: 0 }}>
              <span>Subtotal</span>
              <span className="num">{formatMoney(cart.subtotal)}</span>
            </div>
            <p className="muted" style={{ fontSize: "0.84rem" }}>Shipping is calculated at checkout.</p>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <Button variant="outline" href="/cart" onClick={closeDrawer} className="grow">View cart</Button>
              <Button href="/checkout" onClick={closeDrawer} className="grow">Checkout</Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
