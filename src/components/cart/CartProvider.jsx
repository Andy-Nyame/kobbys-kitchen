"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  addCartItem,
  CART_STORAGE_KEY,
  getCartItemCount,
  parsePersistedCart,
  normalizeCartLines,
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
      hasLoaded,
      itemCount: getCartItemCount(lines),
      addItem: (menuItemId, priceTier = 0) =>
        setLines((current) => addCartItem(current, menuItemId, priceTier)),
      increaseItem: (menuItemId, priceTier) =>
        setLines((current) => {
          const line = current.find(
            (item) =>
              item.menuItemId === menuItemId && item.priceTier === priceTier
          );
          return setCartItemQuantity(
            current,
            menuItemId,
            priceTier,
            (line?.quantity || 0) + 1
          );
        }),
      decreaseItem: (menuItemId, priceTier) =>
        setLines((current) => {
          const line = current.find(
            (item) =>
              item.menuItemId === menuItemId && item.priceTier === priceTier
          );
          return setCartItemQuantity(
            current,
            menuItemId,
            priceTier,
            (line?.quantity || 0) - 1
          );
        }),
      removeItem: (menuItemId, priceTier) =>
        setLines((current) => removeCartItem(current, menuItemId, priceTier)),
      clearCart: () => setLines([]),
      replaceCart: (nextLines) => setLines(normalizeCartLines(nextLines)),
    }),
    [hasLoaded, lines]
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
