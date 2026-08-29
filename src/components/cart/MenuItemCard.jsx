"use client";

import Image from "next/image";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import ImagePlaceholder from "@/components/ui/ImagePlaceholder";
import { formatGhs } from "@/lib/cart/domain";
import { canAddMenuItemToCart } from "@/lib/menu/domain";
import { deriveMenuPriceMinor, MAX_PRICE_TIER } from "@/lib/menu/pricing";

export default function MenuItemCard({ item, categoryName }) {
  const { addItem } = useCart();
  const [failedImage, setFailedImage] = useState(false);
  const [priceTier, setPriceTier] = useState(0);
  const showImage = Boolean(item.image) && !failedImage;
  const selectedPriceMinor = deriveMenuPriceMinor(item, priceTier);

  return (
    <article className="meal-card menu-item-card">
      <div className="meal-card__media">
        {showImage ? (
          <Image
            alt={item.imageAlt}
            className="meal-card__image"
            height={900}
            onError={() => setFailedImage(true)}
            sizes="(min-width: 1200px) 24rem, (min-width: 900px) 30vw, (min-width: 640px) 45vw, 100vw"
            src={item.image}
            width={1200}
          />
        ) : (
          <ImagePlaceholder label={item.name} />
        )}
      </div>
      <div className="meal-card__body">
        <div className="meal-card__meta">
          <span className="meal-card__category">{categoryName}</span>
          {item.featured ? <span className="meal-card__badge">Popular</span> : null}
        </div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <p className="meal-card__price">From {formatGhs(item.priceMinor)}</p>
        {canAddMenuItemToCart(item) ? (
          <div className="menu-price-selector">
            <span className="menu-price-selector__label">Selected amount</span>
            <div className="menu-price-selector__controls">
              <button
                aria-label={`Lower ${item.name} amount by ${formatGhs(item.priceStepMinor)}`}
                disabled={priceTier === 0}
                onClick={() => setPriceTier((current) => Math.max(0, current - 1))}
                type="button"
              >
                −
              </button>
              <strong aria-live="polite">{formatGhs(selectedPriceMinor)}</strong>
              <button
                aria-label={`Raise ${item.name} amount by ${formatGhs(item.priceStepMinor)}`}
                disabled={priceTier === MAX_PRICE_TIER}
                onClick={() => setPriceTier((current) => Math.min(MAX_PRICE_TIER, current + 1))}
                type="button"
              >
                +
              </button>
            </div>
            <button
              className="cart-button"
              onClick={() => addItem(item.id, priceTier)}
              type="button"
            >
              Add {formatGhs(selectedPriceMinor)} to Cart
            </button>
          </div>
        ) : (
          <div className="menu-item-card__footer">
            <span className="menu-item-card__unavailable" role="status">Unavailable</span>
          </div>
        )}
      </div>
    </article>
  );
}
