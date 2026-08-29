"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import { formatGhs, getCartSubtotalMinor, resolveCartLines } from "@/lib/cart/domain";

export default function CartPageContent({ catalogueItems, orderingStatus }) {
  const { clearCart, decreaseItem, increaseItem, lines, removeItem } = useCart();
  const { resolvedLines: cartLines, unresolvedLines } = resolveCartLines(
    lines,
    catalogueItems
  );
  const subtotalMinor = getCartSubtotalMinor(lines, catalogueItems);

  if (lines.length === 0) {
    return (
      <section className="cart-empty-state">
        <h2>Your cart is empty.</h2>
        <p>Browse the menu to add meals and build your pickup order.</p>
        <Link className="button-link button-link--primary" href="/menu">Browse Menu</Link>
      </section>
    );
  }

  return (
    <section className="cart-page" aria-labelledby="cart-summary-title">
      <div className="cart-page__header">
        <div>
          <p className="order-option-card__eyebrow">Cart preview</p>
          <h2 id="cart-summary-title">Your meals</h2>
        </div>
        <button className="cart-text-button" onClick={clearCart} type="button">Clear cart</button>
      </div>

      <ul className="cart-line-list">
        {cartLines.map(({ item, lineTotalMinor, menuItemId, priceTier, quantity, selectedPriceMinor }) => (
          <li className="cart-line" key={`${menuItemId}:${priceTier}`}>
            <div className="cart-line__details">
              <h3>{item.name}</h3>
              <p>{formatGhs(selectedPriceMinor)} each</p>
              {!item.available ? <span className="menu-item-card__unavailable">Currently unavailable</span> : null}
            </div>
            <div className="cart-line__controls">
              <div aria-label={`Quantity for ${item.name}`} className="quantity-control">
                <button aria-label={`Decrease ${item.name} at ${formatGhs(selectedPriceMinor)} quantity`} onClick={() => decreaseItem(menuItemId, priceTier)} type="button">−</button>
                <span aria-live="polite">{quantity}</span>
                <button aria-label={`Increase ${item.name} at ${formatGhs(selectedPriceMinor)} quantity`} onClick={() => increaseItem(menuItemId, priceTier)} type="button">+</button>
              </div>
              <strong>{formatGhs(lineTotalMinor)}</strong>
              <button className="cart-text-button" onClick={() => removeItem(menuItemId, priceTier)} type="button">Remove</button>
            </div>
          </li>
        ))}
      </ul>

      {cartLines.length === 0 ? (
        <p className="cart-page__notice">No current menu selection could be resolved.</p>
      ) : null}

      {unresolvedLines.length ? (
        <div className="cart-page__notice" role="status">
          <p>Some saved cart selections no longer match the current menu. Remove them before a future checkout.</p>
          {unresolvedLines.map((line) => (
            <button
              className="cart-text-button"
              key={`${line.menuItemId}:${line.priceTier}`}
              onClick={() => removeItem(line.menuItemId, line.priceTier)}
              type="button"
            >
              Remove unavailable selection
            </button>
          ))}
        </div>
      ) : null}

      <div className="cart-page__summary">
        <div><span>Subtotal</span><strong>{formatGhs(subtotalMinor)}</strong></div>
        <p>
          {orderingStatus.isOpen
            ? "Checkout revalidates every price and item before placing your pickup order."
            : "Your cart remains saved. Checkout will show when online ordering reopens."}
        </p>
        <Link className="button-link button-link--primary" href="/checkout">
          Continue to Checkout
        </Link>
      </div>
    </section>
  );
}
