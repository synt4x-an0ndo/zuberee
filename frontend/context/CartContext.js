"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* =====================================================================
 * CartContext - cart is stored in localStorage (same behaviour as the
 * original site). No order data lives in the frontend; checkout posts
 * the cart to the backend (POST api/orders).
 * ===================================================================== */

const CartCtx = createContext(null);
const STORAGE_KEY = "cart";

function lineIdOf(item) {
  if (item.lineId) return item.lineId;
  if (item.variant_id) return `${item.id}::v${item.variant_id}`;
  return `${item.id}::${item.size ?? ""}::${item.color_name || item.colorImage || ""}`;
}

function loadInitial() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((e) => ({ ...e, lineId: e.lineId || lineIdOf(e) }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [checkoutSignal, setCheckoutSignal] = useState(0);

  useEffect(() => {
    setItems(loadInitial());
    setHydrated(true);
  }, []);

  const persist = useCallback((next) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }, []);

  const addToCart = useCallback(
    (item) => {
      setItems((prev) => {
        const id = lineIdOf(item);
        const existing = prev.find((e) => e.lineId === id);
        let next;
        if (existing) {
          const qty = (existing.qty || 1) + (item.qty || 1);
          const capped = item.max_qty ? Math.min(qty, item.max_qty) : qty;
          next = prev.map((e) =>
            e.lineId === id
              ? { ...e, qty: capped, totalPrice: e.unitPrice * capped }
              : e
          );
        } else {
          const qty = item.qty || 1;
          next = [
            ...prev,
            {
              ...item,
              lineId: id,
              qty,
              totalPrice: (item.unitPrice ?? 0) * qty,
            },
          ];
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setQty = useCallback(
    (lineId, qty) => {
      setItems((prev) => {
        const next = prev.map((e) => {
          if (e.lineId !== lineId) return e;
          const q = e.max_qty ? Math.min(qty, e.max_qty) : qty;
          return { ...e, qty: q, totalPrice: e.unitPrice * q };
        });
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const inc = useCallback(
    (lineId) =>
      setItems((prev) => {
        const next = prev.map((e) =>
          e.lineId === lineId && (!e.max_qty || e.qty < e.max_qty)
            ? { ...e, qty: e.qty + 1, totalPrice: e.unitPrice * (e.qty + 1) }
            : e
        );
        persist(next);
        return next;
      }),
    [persist]
  );

  const dec = useCallback(
    (lineId) =>
      setItems((prev) => {
        const next = prev.map((e) =>
          e.lineId === lineId && e.qty > 1
            ? { ...e, qty: e.qty - 1, totalPrice: e.unitPrice * (e.qty - 1) }
            : e
        );
        persist(next);
        return next;
      }),
    [persist]
  );

  const removeItem = useCallback(
    (lineId) =>
      setItems((prev) => {
        const next = prev.filter((e) => e.lineId !== lineId);
        persist(next);
        return next;
      }),
    [persist]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    persist([]);
  }, [persist]);

  const total = useMemo(
    () => items.reduce((s, e) => s + (e.totalPrice ?? e.unitPrice * e.qty ?? 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      total,
      open,
      hydrated,
      checkoutSignal,
      setOpen,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      /** Open the drawer straight on the checkout tab (used by "Buy Now"). */
      openCheckout: () => {
        setCheckoutSignal((n) => n + 1);
        setOpen(true);
      },
      addToCart,
      setQty,
      inc,
      dec,
      removeItem,
      clearCart,
    }),
    [items, total, open, hydrated, checkoutSignal, addToCart, setQty, inc, dec, removeItem, clearCart]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
