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
  serializeCart,
  setCartItemQuantity,
} from "../lib/cart/domain.js";

const jollofId = "11111111-1111-4111-8111-111111111111";
const friedRiceId = "22222222-2222-4222-8222-222222222222";
const catalogue = [
  { id: jollofId, priceMinor: 3000 },
  { id: friedRiceId, priceMinor: 2500 },
];

describe("cart domain", () => {
  it("adds an item and increments a duplicate instead of creating a second line", () => {
    const once = addCartItem([], jollofId);
    const twice = addCartItem(once, jollofId);

    assert.deepEqual(twice, [{ menuItemId: jollofId, quantity: 2 }]);
  });

  it("increases, decreases, removes, and clears quantities safely", () => {
    const lines = [
      { menuItemId: jollofId, quantity: 2 },
      { menuItemId: friedRiceId, quantity: 1 },
    ];

    assert.deepEqual(setCartItemQuantity(lines, jollofId, 3)[0], {
      menuItemId: jollofId,
      quantity: 3,
    });
    assert.equal(setCartItemQuantity(lines, jollofId, 0).length, 1);
    assert.equal(removeCartItem(lines, friedRiceId).length, 1);
    assert.deepEqual(setCartItemQuantity(lines, jollofId, -1), [
      { menuItemId: friedRiceId, quantity: 1 },
    ]);
  });

  it("caps quantities and rejects invalid ids", () => {
    const capped = setCartItemQuantity([], jollofId, MAX_CART_ITEM_QUANTITY + 10);
    assert.deepEqual(capped, []);

    const line = addCartItem([{ menuItemId: jollofId, quantity: MAX_CART_ITEM_QUANTITY }], jollofId);
    assert.equal(line[0].quantity, MAX_CART_ITEM_QUANTITY);
    assert.deepEqual(addCartItem([], "not-an-id"), []);
  });

  it("uses integer minor units for subtotal and formatting", () => {
    const lines = [
      { menuItemId: jollofId, quantity: 2 },
      { menuItemId: friedRiceId, quantity: 1 },
    ];

    assert.equal(getCartSubtotalMinor(lines, catalogue), 8500);
    assert.equal(formatGhs(8500), "GH₵85.00");
    assert.equal(getCartItemCount(lines), 3);
  });

  it("fails closed for malformed, old, or duplicate persisted cart data", () => {
    assert.deepEqual(parsePersistedCart("not-json"), []);
    assert.deepEqual(parsePersistedCart(JSON.stringify({ version: 0, lines: [] })), []);

    const parsed = parsePersistedCart(
      JSON.stringify({
        version: CART_STORAGE_VERSION,
        lines: [
          { menuItemId: jollofId, quantity: 1 },
          { menuItemId: jollofId, quantity: 3 },
          { menuItemId: "bad", quantity: 8 },
        ],
      })
    );

    assert.deepEqual(parsed, [{ menuItemId: jollofId, quantity: 4 }]);
    assert.deepEqual(parsePersistedCart(serializeCart(parsed)), parsed);
  });
});
