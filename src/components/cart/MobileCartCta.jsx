"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CartIcon } from "@/components/cart/CartLink";
import { useCart } from "@/components/cart/CartProvider";
import { formatGhs, getCartSubtotalMinor } from "@/lib/cart/domain";
import { shouldShowMobileCartCta } from "@/lib/cart/mobile-cart";

export default function MobileCartCta({ catalogueItems }) {
  const pathname = usePathname();
  const { hasLoaded, itemCount, lines } = useCart();

  if (!hasLoaded || !shouldShowMobileCartCta(pathname, itemCount)) {
    return null;
  }

  const total = formatGhs(getCartSubtotalMinor(lines, catalogueItems));
  const itemLabel = `${itemCount} item${itemCount === 1 ? "" : "s"}`;

  return (
    <>
      <div className="mobile-cart-cta-shell">
        <Link
          aria-label={`View cart, ${itemLabel}, ${total}`}
          className="mobile-cart-cta"
          href="/cart"
        >
          <span aria-hidden="true" className="mobile-cart-cta__icon">
            <CartIcon />
          </span>
          <span className="mobile-cart-cta__copy">
            <span>View Cart</span>
            <strong>{total}</strong>
          </span>
          <span aria-hidden="true" className="mobile-cart-cta__count">
            {itemCount}
          </span>
        </Link>
      </div>
      <div aria-hidden="true" className="mobile-cart-cta-spacer" />
    </>
  );
}
