"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, API_CONFIGURED, imgUrl, unwrap } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartContext = createContext(null);

function normalizeCart(raw) {
  const items = (Array.isArray(raw?.items) ? raw.items : []).map((item) => ({
    id: item.id,
    productId: item.product_id,
    title: item.title || "Product",
    sku: item.sku || "",
    image: imgUrl(item.image),
    variant: item.variant
      ? { id: item.variant.id, label: item.variant.value || item.variant.name || "", stock: Number(item.variant.stock ?? 0) }
      : null,
    color: item.color ? { id: item.color.id, name: item.color.name, code: item.color.code } : null,
    unitPrice: Number(item.unit_price) || 0,
    quantity: Number(item.quantity) || 0,
    subtotal: Number(item.subtotal) || 0,
  }));
  return {
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

const EMPTY_CART = { items: [], totalItems: 0, subtotal: 0 };

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bumpKey, setBumpKey] = useState(0);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!API_CONFIGURED) {
      setLoading(false);
      return;
    }
    const current = ++requestId.current;
    try {
      const response = await api.get("api/cart");
      if (current === requestId.current) setCart(normalizeCart(unwrap(response)));
    } catch {
      if (current === requestId.current) setCart(EMPTY_CART);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, []);

  // Re-read the cart whenever the signed-in identity changes (guest cart merges on login).
  const identity = user?.id ?? "guest";
  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [identity, authLoading, refresh]);

  const addItem = useCallback(
    async ({ productId, variantId = null, colorId = null, quantity = 1 }) => {
      await api.post("api/cart", { productId, variantId, colorId, quantity });
      await refresh();
      setBumpKey((key) => key + 1);
      setDrawerOpen(true);
    },
    [refresh]
  );

  const updateItem = useCallback(
    async (itemId, quantity) => {
      await api.put(`api/cart/${itemId}`, { quantity });
      await refresh();
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId) => {
      await api.delete(`api/cart/${itemId}`);
      await refresh();
    },
    [refresh]
  );

  /** DELETE /api/cart — empties the whole cart (guest cart or the signed-in user's cart). */
  const clearCart = useCallback(async () => {
    await api.delete("api/cart");
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      cart,
      loading,
      count: cart.totalItems,
      subtotal: cart.subtotal,
      bumpKey,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      refresh,
      addItem,
      updateItem,
      removeItem,
      clearCart,
    }),
    [cart, loading, bumpKey, drawerOpen, refresh, addItem, updateItem, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
