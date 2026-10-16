"use client";

import Link from "next/link";
import { useState } from "react";
import { FiArrowRight, FiMinus, FiPlus, FiShoppingBag, FiTrash2 } from "react-icons/fi";
import Img from "@/components/Img";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { useFeedback } from "@/context/FeedbackContext";
import { formatMoney } from "@/lib/api";

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, clearCart } = useCart();
  const { toast, confirm } = useFeedback();
  const [pending, setPending] = useState(null);
  const [clearing, setClearing] = useState(false);

  const run = async (itemId, action) => {
    setPending(itemId);
    try {
      await action();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(null);
    }
  };

  const clear = async () => {
    const ok = await confirm({
      title: "Clear your cart?",
      message: "Every item will be removed from your cart.",
      confirmText: "Clear cart",
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

  const changeQty = (item, next) => {
    const max = item.variant && item.variant.stock > 0 ? item.variant.stock : 99;
    if (next < 1 || next > max) return;
    run(item.id, async () => {
      await updateItem(item.id, next);
      toast.success(`${item.title} quantity updated.`);
    });
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: "Remove this item?",
      message: `${item.title} will be removed from your cart.`,
      confirmText: "Remove",
      danger: true,
    });
    if (ok) {
      run(item.id, async () => {
        await removeItem(item.id);
        toast.success(`${item.title} removed from your cart.`);
      });
    }
  };

  if (loading) {
    return (
      <div className="container section">
        <Skeleton style={{ height: 36, width: 220, marginBottom: 24 }} />
        <Skeleton style={{ height: 320 }} />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="container section">
        <EmptyState
          icon={FiShoppingBag}
          title="Your cart is empty"
          text="Browse the collection and your picks will appear here."
          action={<Button href="/shop" variant="primary">Start shopping</Button>}
        />
      </div>
    );
  }

  return (
    <div className="container section anim-fade-up">
      <div className="page-header">
        <div>
          <p className="eyebrow">Your bag</p>
          <h1>Shopping cart</h1>
        </div>
        <p className="muted">{cart.totalItems} {cart.totalItems === 1 ? "item" : "items"}</p>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <Button variant="outline" size="sm" loading={clearing} disabled={clearing} onClick={clear} style={{ color: "#b3261e", borderColor: "#e5c2bf" }}>
          <FiTrash2 aria-hidden="true" /> Clear all
        </Button>
      </div>

      <div className="cart-layout">
        <ul className="cart-list stagger" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {cart.items.map((item) => {
            const busy = pending === item.id;
            const max = item.variant && item.variant.stock > 0 ? item.variant.stock : 99;
            return (
              <li key={item.id} className="cart-line" aria-busy={busy}>
                <Link href={`/product-page/${item.productId}`} className="cart-thumb">
                  <Img src={item.image} alt={item.title} fill sizes="110px" />
                </Link>
                <div className="cart-info">
                  <Link href={`/product-page/${item.productId}`} className="cart-title">{item.title}</Link>
                  <div className="cart-meta">
                    {item.variant?.label && <span>Size {item.variant.label}</span>}
                    {item.color?.name && (
                      <span className="cart-color">
                        {item.color.code && <i style={{ background: item.color.code }} aria-hidden="true" />}
                        {item.color.name}
                      </span>
                    )}
                  </div>
                  <span className="muted num" style={{ fontSize: "0.9rem" }}>{formatMoney(item.unitPrice)}</span>
                </div>
                <div className="cart-actions">
                  <div className="qty" role="group" aria-label="Quantity">
                    <button type="button" onClick={() => changeQty(item, item.quantity - 1)} disabled={busy || item.quantity <= 1} aria-label="Decrease quantity">
                      <FiMinus aria-hidden="true" />
                    </button>
                    <span className="num">{item.quantity}</span>
                    <button type="button" onClick={() => changeQty(item, item.quantity + 1)} disabled={busy || item.quantity >= max} aria-label="Increase quantity">
                      <FiPlus aria-hidden="true" />
                    </button>
                  </div>
                  <span className="num cart-line-total">{formatMoney(item.subtotal)}</span>
                  <button type="button" className="icon-btn cart-remove" onClick={() => remove(item)} disabled={busy} aria-label={`Remove ${item.title}`}>
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="summary" aria-label="Order summary">
          <h2 style={{ fontSize: "1.15rem" }}>Order summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span className="num">{formatMoney(cart.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <span className="muted">Calculated at checkout</span>
          </div>
          <div className="summary-row summary-total">
            <span>Estimated total</span>
            <span className="num">{formatMoney(cart.subtotal)}</span>
          </div>
          <Button href="/checkout" variant="primary" size="lg" block>
            Proceed to checkout <FiArrowRight aria-hidden="true" />
          </Button>
          <Button href="/shop" variant="ghost" block>Continue shopping</Button>
        </aside>
      </div>
    </div>
  );
}
