"use client";

import Image from "next/image";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import ImagePlaceholder from "@/components/ui/ImagePlaceholder";
import { formatGhs } from "@/lib/cart/domain";
import { canAddMenuItemToCart } from "@/lib/menu/domain";

export default function MenuItemCard({ item, categoryName }) {
  const { addItem } = useCart();
  const [failedImage, setFailedImage] = useState(false);
  const showImage = Boolean(item.image) && !failedImage;

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
        <div className="menu-item-card__footer">
          <strong className="meal-card__price">{formatGhs(item.priceMinor)}</strong>
          {canAddMenuItemToCart(item) ? (
            <button className="cart-button" onClick={() => addItem(item.id)} type="button">
              Add to Cart
            </button>
          ) : (
            <span className="menu-item-card__unavailable" role="status">Unavailable</span>
          )}
        </div>
      </div>
    </article>
  );
}
