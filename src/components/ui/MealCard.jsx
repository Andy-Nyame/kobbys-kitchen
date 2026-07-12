"use client";

import Image from "next/image";
import { useState } from "react";

import ImagePlaceholder from "@/components/ui/ImagePlaceholder";

export default function MealCard({ item, showPopular = false }) {
  const [failedImage, setFailedImage] = useState("");
  const showImage = Boolean(item.image) && failedImage !== item.image;

  return (
    <article className="meal-card">
      <div className="meal-card__media">
        {showImage ? (
          <Image
            alt={`${item.name} from Kobby’s Kitchen`}
            className="meal-card__image"
            onError={() => setFailedImage(item.image)}
            sizes="(min-width: 1200px) 24rem, (min-width: 900px) 30vw, (min-width: 640px) 45vw, 100vw"
            src={item.image}
            width={1200}
            height={900}
          />
        ) : (
          <ImagePlaceholder label={item.name} />
        )}
      </div>

      <div className="meal-card__body">
        <div className="meal-card__meta">
          <span className="meal-card__category">{item.category}</span>
          {showPopular && item.featured ? (
            <span className="meal-card__badge">Popular</span>
          ) : null}
        </div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <strong className="meal-card__price">{item.priceLabel}</strong>
      </div>
    </article>
  );
}
