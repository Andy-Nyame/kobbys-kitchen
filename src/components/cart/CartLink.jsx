"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";

export function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

export default function CartLink({ mobileHeader = false }) {
  const { itemCount } = useCart();
  const itemLabel = `${itemCount} item${itemCount === 1 ? "" : "s"}`;
  const className = mobileHeader
    ? "header-cart-link mobile-header-cart-link"
    : "header-cart-link";

  return (
    <Link
      aria-label={itemCount > 0 ? `Cart, ${itemLabel}` : "Cart"}
      className={className}
      href="/cart"
    >
      <CartIcon />
      <span className="sr-only">Cart</span>
      {itemCount > 0 ? (
        <span aria-hidden="true" className="header-cart-link__count">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}
