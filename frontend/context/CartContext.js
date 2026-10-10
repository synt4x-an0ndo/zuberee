"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, imgUrl, unwrapObject } from "@/lib/api";
import notify from "@/components/notify";

/* =====================================================================
 * CartContext - the backend is the source of truth for guest and logged-in carts.
 * ===================================================================== */

const CartCtx = createContext(null);
function normalizeCartItem(item) {
  const variant = item.variant || null;
  const color = item.color || null;
  return {
    ...item,
    lineId: String(item.id),
    id: item.product_id ?? item.productId ?? item.id,
    cartItemId: item.id,
    variant_id: variant?.id ?? item.variant_id ?? item.variantId ?? null,
    product_color_id: color?.id ?? item.color_id ?? item.colorId ?? null,
    title: item.title || item.product?.title || item.product?.name || "Product",
    image: imgUrl(item.image || item.product?.images?.[0] || item.product?.image),
    colorImage: imgUrl(color),
    size_label: variant?.value || variant?.name || item.size_label || null,
    color_name: color?.name || item.color_name || null,
    unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
    qty: Number(item.quantity ?? item.qty ?? 1),
    totalPrice: Number(item.subtotal ?? item.totalPrice ?? 0),
    max_qty: variant?.stock ?? item.max_qty ?? null,
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutSignal, setCheckoutSignal] = useState(0);

  const refreshCart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("api/cart");
      const cart = unwrapObject(response) || {};
      setItems(Array.isArray(cart.items) ? cart.items.map(normalizeCartItem) : []);
      return cart;
    } catch (cause) {
      setError(cause.message || "Could not load your cart.");
      throw cause;
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refreshCart().catch(() => { });
    const onAuthChanged = () => refreshCart().catch(() => { });
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, [refreshCart]);

  const addToCart = useCallback(
    async (item) => {
      try {
        await api.post("api/cart", {
          productId: Number(item.id),
          ...(item.variant_id ? { variantId: Number(item.variant_id) } : {}),
          ...(item.product_color_id || item.color_id ? { colorId: Number(item.product_color_id || item.color_id) } : {}),
          quantity: Number(item.qty) || 1,
        });
        await refreshCart();
      } catch (cause) {
        notify.error(cause.message || "Could not add this item to your cart.");
        throw cause;
      }
    },
    [refreshCart]
  );

  const setQty = useCallback(
    async (lineId, qty) => {
      try {
        await api.put(`api/cart/${lineId}`, { quantity: Number(qty) });
        await refreshCart();
      } catch (cause) {
        notify.error(cause.message || "Could not update your cart.");
      }
    },
    [refreshCart]
  );

  const inc = useCallback(
    (lineId) => {
      const item = items.find((entry) => entry.lineId === lineId);
      if (item) return setQty(lineId, item.qty + 1);
    },
    [items, setQty]
  );

  const dec = useCallback(
    (lineId) => {
      const item = items.find((entry) => entry.lineId === lineId);
      if (item && item.qty > 1) return setQty(lineId, item.qty - 1);
    },
    [items, setQty]
  );

  const removeItem = useCallback(
    async (lineId) => {
      try {
        await api.delete(`api/cart/${lineId}`);
        await refreshCart();
      } catch (cause) {
        notify.error(cause.message || "Could not remove this item.");
      }
    },
    [refreshCart]
  );

  const clearCart = useCallback(async () => {
    try {
      await api.delete("api/cart");
      setItems([]);
    } catch (cause) {
      notify.error(cause.message || "Could not clear your cart.");
    }
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.totalPrice) || Number(item.unitPrice) * item.qty || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      total,
      open,
      hydrated,
      loading,
      error,
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
      refreshCart,
      setQty,
      inc,
      dec,
      removeItem,
      clearCart,
    }),
    [items, total, open, hydrated, loading, error, checkoutSignal, addToCart, refreshCart, setQty, inc, dec, removeItem, clearCart]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
