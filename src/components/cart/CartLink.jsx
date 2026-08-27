"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";

function CartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 7H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

export default function CartLink({ mobile = false }) {
  const { itemCount } = useCart();
  const className = mobile ? "mobile-navigation__cart" : "header-cart-link";

  return (
    <Link aria-label={`View cart${itemCount ? `, ${itemCount} items` : ""}`} className={className} href="/cart">
      <CartIcon />
      {mobile ? <span>Cart</span> : <span className="sr-only">Cart</span>}
      <span aria-hidden="true" className="header-cart-link__count">
        {itemCount}
      </span>
    </Link>
  );
}
