"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  addCartItem,
  CART_STORAGE_KEY,
  getCartItemCount,
  parsePersistedCartState,
  normalizeCartLines,
  removeCartItem,
  serializeCart,
  setCartItemQuantity,
} from "@/lib/cart/domain";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);
  const [promoCode, setPromoCode] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = parsePersistedCartState(
          window.localStorage.getItem(CART_STORAGE_KEY)
        );
        setLines(stored.lines);
        setPromoCode(stored.promoCode);
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
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        serializeCart(lines, promoCode)
      );
    } catch {
      // A blocked or full localStorage should not prevent cart use in memory.
    }
  }, [hasLoaded, lines, promoCode]);

  const value = useMemo(
    () => ({
      lines,
      promoCode,
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
      applyPromoCode: (code) => setPromoCode(code),
      removePromoCode: () => setPromoCode(null),
      clearCart: () => {
        setLines([]);
        setPromoCode(null);
      },
      replaceCart: (nextLines) => setLines(normalizeCartLines(nextLines)),
    }),
    [hasLoaded, lines, promoCode]
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
