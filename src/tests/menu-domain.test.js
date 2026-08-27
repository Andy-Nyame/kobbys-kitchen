import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAddMenuItemToCart,
  normalizeCatalogueItem,
} from "../lib/menu/domain.js";

describe("public menu catalogue domain", () => {
  it("normalizes trusted integer-minor-unit menu data", () => {
    const item = normalizeCatalogueItem({
      id: "11111111-1111-4111-8111-111111111111",
      category_id: "22222222-2222-4222-8222-222222222222",
      slug: "jollof-rice",
      name: "Jollof Rice",
      description: "A flavourful rice meal.",
      image_path: "/images/food/jollof-rice.png",
      image_alt: "Jollof Rice",
      price_minor: 3000,
      currency: "GHS",
      available: false,
      featured: true,
    });

    assert.deepEqual(item, {
      id: "11111111-1111-4111-8111-111111111111",
      categoryId: "22222222-2222-4222-8222-222222222222",
      slug: "jollof-rice",
      name: "Jollof Rice",
      description: "A flavourful rice meal.",
      image: "/images/food/jollof-rice.png",
      imageAlt: "Jollof Rice",
      priceMinor: 3000,
      currency: "GHS",
      available: false,
      featured: true,
    });
  });

  it("rejects invalid price, currency, or missing identifiers", () => {
    assert.equal(normalizeCatalogueItem({ price_minor: 30 }), null);
    assert.equal(
      normalizeCatalogueItem({
        id: "id",
        category_id: "category",
        name: "Meal",
        price_minor: 30.5,
        currency: "GHS",
      }),
      null
    );
    assert.equal(
      normalizeCatalogueItem({
        id: "id",
        category_id: "category",
        name: "Meal",
        price_minor: 3000,
        currency: "USD",
      }),
      null
    );
  });

  it("allows only explicitly available menu items to be added to the cart", () => {
    assert.equal(
      canAddMenuItemToCart({ id: "11111111-1111-4111-8111-111111111111", available: true }),
      true
    );
    assert.equal(
      canAddMenuItemToCart({ id: "11111111-1111-4111-8111-111111111111", available: false }),
      false
    );
    assert.equal(canAddMenuItemToCart({ available: true }), false);
  });
});
