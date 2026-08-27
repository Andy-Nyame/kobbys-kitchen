"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  addCartItem,
  CART_STORAGE_KEY,
  getCartItemCount,
  parsePersistedCart,
  removeCartItem,
  serializeCart,
  setCartItemQuantity,
} from "@/lib/cart/domain";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setLines(parsePersistedCart(window.localStorage.getItem(CART_STORAGE_KEY)));
      } catch {
        setLines([]);
      } finally {
        setHasLoaded(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
    } catch {
      // A blocked or full localStorage should not prevent cart use in memory.
    }
  }, [hasLoaded, lines]);

  const value = useMemo(
    () => ({
      lines,
      itemCount: getCartItemCount(lines),
      addItem: (menuItemId) => setLines((current) => addCartItem(current, menuItemId)),
      increaseItem: (menuItemId) =>
        setLines((current) => {
          const line = current.find((item) => item.menuItemId === menuItemId);
          return setCartItemQuantity(current, menuItemId, (line?.quantity || 0) + 1);
        }),
      decreaseItem: (menuItemId) =>
        setLines((current) => {
          const line = current.find((item) => item.menuItemId === menuItemId);
          return setCartItemQuantity(current, menuItemId, (line?.quantity || 0) - 1);
        }),
      removeItem: (menuItemId) => setLines((current) => removeCartItem(current, menuItemId)),
      clearCart: () => setLines([]),
    }),
    [lines]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);

  if (!cart) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return cart;
}
