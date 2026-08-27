"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import { formatGhs, getCartSubtotalMinor } from "@/lib/cart/domain";

export default function CartPageContent({ catalogueItems }) {
  const { clearCart, decreaseItem, increaseItem, lines, removeItem } = useCart();
  const itemsById = new Map(catalogueItems.map((item) => [item.id, item]));
  const cartLines = lines
    .map((line) => ({ ...line, item: itemsById.get(line.menuItemId) }))
    .filter((line) => line.item);
  const unavailableLines = lines.length - cartLines.length;
  const subtotalMinor = getCartSubtotalMinor(lines, catalogueItems);

  if (cartLines.length === 0) {
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
        {cartLines.map(({ item, menuItemId, quantity }) => (
          <li className="cart-line" key={menuItemId}>
            <div className="cart-line__details">
              <h3>{item.name}</h3>
              <p>{formatGhs(item.priceMinor)} each</p>
              {!item.available ? <span className="menu-item-card__unavailable">Currently unavailable</span> : null}
            </div>
            <div className="cart-line__controls">
              <div aria-label={`Quantity for ${item.name}`} className="quantity-control">
                <button aria-label={`Decrease ${item.name} quantity`} onClick={() => decreaseItem(menuItemId)} type="button">−</button>
                <span aria-live="polite">{quantity}</span>
                <button aria-label={`Increase ${item.name} quantity`} onClick={() => increaseItem(menuItemId)} type="button">+</button>
              </div>
              <strong>{formatGhs(item.priceMinor * quantity)}</strong>
              <button className="cart-text-button" onClick={() => removeItem(menuItemId)} type="button">Remove</button>
            </div>
          </li>
        ))}
      </ul>

      {unavailableLines ? <p className="cart-page__notice" role="status">Items no longer in the menu were removed from this preview.</p> : null}

      <div className="cart-page__summary">
        <div><span>Subtotal</span><strong>{formatGhs(subtotalMinor)}</strong></div>
        <p>Online checkout is being prepared. Building a cart does not place an order.</p>
        <span aria-disabled="true" className="button-link button-link--disabled">Checkout unavailable</span>
      </div>
    </section>
  );
}
