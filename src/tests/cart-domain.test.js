import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCartItem,
  CART_STORAGE_VERSION,
  formatGhs,
  getCartItemCount,
  getCartSubtotalMinor,
  MAX_CART_ITEM_QUANTITY,
  parsePersistedCart,
  removeCartItem,
  resolveCartLines,
  serializeCart,
  setCartItemQuantity,
} from "../lib/cart/domain.js";

const jollofId = "11111111-1111-4111-8111-111111111111";
const friedRiceId = "22222222-2222-4222-8222-222222222222";
const catalogue = [
  { id: jollofId, priceMinor: 3000, priceStepMinor: 1000, available: true },
  { id: friedRiceId, priceMinor: 2500, priceStepMinor: 500, available: true },
];

describe("tier-aware cart domain", () => {
  it("combines the same item/tier and keeps different tiers separate", () => {
    let lines = addCartItem([], jollofId, 0);
    lines = addCartItem(lines, jollofId, 1);
    lines = addCartItem(lines, jollofId, 1);
    lines = addCartItem(lines, jollofId, 1);

    assert.deepEqual(lines, [
      { menuItemId: jollofId, priceTier: 0, quantity: 1 },
      { menuItemId: jollofId, priceTier: 1, quantity: 3 },
    ]);
  });

  it("changes and removes only the exact item/tier line", () => {
    const lines = [
      { menuItemId: jollofId, priceTier: 0, quantity: 1 },
      { menuItemId: jollofId, priceTier: 1, quantity: 2 },
    ];
    const increased = setCartItemQuantity(lines, jollofId, 1, 3);

    assert.equal(increased[0].quantity, 1);
    assert.equal(increased[1].quantity, 3);
    assert.deepEqual(removeCartItem(increased, jollofId, 0), [
      { menuItemId: jollofId, priceTier: 1, quantity: 3 },
    ]);
    assert.equal(setCartItemQuantity(increased, jollofId, 1, 0).length, 1);
  });

  it("caps quantities and rejects invalid ids or tiers", () => {
    const capped = addCartItem(
      [{ menuItemId: jollofId, priceTier: 0, quantity: MAX_CART_ITEM_QUANTITY }],
      jollofId,
      0
    );

    assert.equal(capped[0].quantity, MAX_CART_ITEM_QUANTITY);
    assert.deepEqual(addCartItem([], "not-an-id", 0), []);
    assert.deepEqual(addCartItem([], jollofId, -1), []);
    assert.deepEqual(addCartItem([], jollofId, 1.5), []);
  });

  it("derives integer-pesewa prices and totals from current catalogue rules", () => {
    const lines = [
      { menuItemId: jollofId, priceTier: 0, quantity: 1 },
      { menuItemId: jollofId, priceTier: 1, quantity: 2 },
      { menuItemId: friedRiceId, priceTier: 2, quantity: 1 },
    ];
    const resolved = resolveCartLines(lines, catalogue);

    assert.deepEqual(
      resolved.resolvedLines.map((line) => line.selectedPriceMinor),
      [3000, 4000, 3500]
    );
    assert.equal(getCartSubtotalMinor(lines, catalogue), 14500);
    assert.equal(formatGhs(14500), "GH₵145.00");
    assert.equal(getCartItemCount(lines), 4);

    const repriced = [{ ...catalogue[0], priceMinor: 3500, priceStepMinor: 500 }];
    assert.equal(
      resolveCartLines([{ menuItemId: jollofId, priceTier: 1, quantity: 1 }], repriced)
        .resolvedLines[0].selectedPriceMinor,
      4000
    );
  });

  it("migrates version 1 lines to tier zero and validates version 2", () => {
    const legacy = parsePersistedCart(
      JSON.stringify({
        version: 1,
        lines: [
          { menuItemId: jollofId, quantity: 1 },
          { menuItemId: jollofId, quantity: 3 },
        ],
      })
    );
    assert.deepEqual(legacy, [
      { menuItemId: jollofId, priceTier: 0, quantity: 4 },
    ]);

    const current = [
      { menuItemId: jollofId, priceTier: 0, quantity: 1 },
      { menuItemId: jollofId, priceTier: 1, quantity: 2 },
    ];
    assert.deepEqual(parsePersistedCart(serializeCart(current)), current);
    assert.deepEqual(parsePersistedCart("not-json"), []);
    assert.deepEqual(
      parsePersistedCart(
        JSON.stringify({
          version: CART_STORAGE_VERSION,
          lines: [{ menuItemId: jollofId, priceTier: "40.00", quantity: 1 }],
        })
      ),
      []
    );
  });
});
