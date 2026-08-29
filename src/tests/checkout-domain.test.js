import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CheckoutDomainError,
  createOrderReference,
  deriveTrustedOrderLines,
  getCheckoutAuthorization,
  validateCheckoutPayload,
} from "../lib/orders/checkout-domain.js";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function payload(overrides = {}) {
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    customerName: "Ama Mensah",
    customerPhone: "020 123 4567",
    note: "No pepper",
    paymentMethod: "CASH",
    lines: [
      {
        menuItemId: ITEM_ID,
        priceTier: 0,
        quantity: 1,
        expectedUnitPriceMinor: 3000,
      },
    ],
    ...overrides,
  };
}

function menuItem(overrides = {}) {
  return {
    id: ITEM_ID,
    name: "Indomie",
    priceMinor: 3000,
    priceStepMinor: 1000,
    currency: "GHS",
    available: true,
    active: true,
    category: { active: true },
    ...overrides,
  };
}

describe("trusted pickup checkout domain", () => {
  it("authorizes CUSTOMER only and never infers a role from client identity", () => {
    assert.equal(getCheckoutAuthorization(null, null).status, 401);
    assert.equal(getCheckoutAuthorization({ id: "admin" }, "ADMIN").status, 403);
    assert.equal(getCheckoutAuthorization({ id: "customer" }, "CUSTOMER").allowed, true);
  });

  it("normalizes Ghana pickup details and safely stores a bounded plain-text note", () => {
    const result = validateCheckoutPayload(payload({ note: "  No pepper\nplease  " }));
    assert.equal(result.customerPhone, "+233201234567");
    assert.equal(result.customerName, "Ama Mensah");
    assert.equal(result.note, "No pepper please");
  });

  it("rejects malformed phone, notes, quantities, tiers and empty carts", () => {
    for (const invalid of [
      payload({ customerPhone: "not-a-phone" }),
      payload({ note: "x".repeat(501) }),
      payload({ lines: [] }),
      payload({ lines: [{ menuItemId: ITEM_ID, priceTier: -1, quantity: 1 }] }),
      payload({ lines: [{ menuItemId: ITEM_ID, priceTier: 0, quantity: 21 }] }),
    ]) {
      assert.throws(() => validateCheckoutPayload(invalid), CheckoutDomainError);
    }
  });

  it("keeps Mobile Money and Card visible-only until verified payment exists", () => {
    assert.throws(
      () => validateCheckoutPayload(payload({ paymentMethod: "MOBILE_MONEY" })),
      (error) => error.code === "PAYMENT_METHOD_UNAVAILABLE"
    );
    assert.throws(
      () => validateCheckoutPayload(payload({ paymentMethod: "CARD" })),
      (error) => error.code === "PAYMENT_METHOD_UNAVAILABLE"
    );
  });

  it("derives GH₵30/GH₵40 tiers and preserves them as separate snapshots", () => {
    const checkout = validateCheckoutPayload(
      payload({
        lines: [
          { menuItemId: ITEM_ID, priceTier: 0, quantity: 1, expectedUnitPriceMinor: 3000 },
          { menuItemId: ITEM_ID, priceTier: 1, quantity: 2, expectedUnitPriceMinor: 4000 },
        ],
      })
    );
    const result = deriveTrustedOrderLines(checkout.lines, [menuItem()]);

    assert.equal(result.lines.length, 2);
    assert.deepEqual(
      result.lines.map((line) => [line.priceTier, line.unitPriceMinor, line.quantity, line.lineTotalMinor]),
      [[0, 3000, 1, 3000], [1, 4000, 2, 8000]]
    );
    assert.equal(result.totalMinor, 11000);
  });

  it("also derives GH₵25/GH₵30 tiers using integer pesewas", () => {
    const lines = validateCheckoutPayload(
      payload({
        lines: [
          { menuItemId: ITEM_ID, priceTier: 0, quantity: 1, expectedUnitPriceMinor: 2500 },
          { menuItemId: ITEM_ID, priceTier: 1, quantity: 1, expectedUnitPriceMinor: 3000 },
        ],
      })
    ).lines;
    const result = deriveTrustedOrderLines(lines, [
      menuItem({ priceMinor: 2500, priceStepMinor: 500 }),
    ]);

    assert.deepEqual(result.lines.map((line) => line.unitPriceMinor), [2500, 3000]);
    assert.equal(result.totalMinor, 5500);
  });

  it("ignores malicious browser prices and detects a genuinely stale displayed price", () => {
    const trusted = validateCheckoutPayload(
      payload({
        lines: [{ menuItemId: ITEM_ID, priceTier: 0, quantity: 1, priceMinor: 1 }],
      })
    );
    assert.equal(
      deriveTrustedOrderLines(trusted.lines, [menuItem()]).lines[0].unitPriceMinor,
      3000
    );

    const stale = validateCheckoutPayload(payload());
    assert.throws(
      () => deriveTrustedOrderLines(stale.lines, [menuItem({ priceMinor: 3500 })]),
      (error) => error.code === "PRICE_CHANGED" && error.details.subtotalMinor === 3500
    );
  });

  it("rejects removed, inactive, category-hidden and unavailable items", () => {
    const lines = validateCheckoutPayload(payload()).lines;
    assert.throws(() => deriveTrustedOrderLines(lines, []), (error) => error.code === "ITEM_REMOVED");
    assert.throws(() => deriveTrustedOrderLines(lines, [menuItem({ active: false })]), (error) => error.code === "ITEM_REMOVED");
    assert.throws(() => deriveTrustedOrderLines(lines, [menuItem({ category: { active: false } })]), (error) => error.code === "ITEM_REMOVED");
    assert.throws(() => deriveTrustedOrderLines(lines, [menuItem({ available: false })]), (error) => error.code === "ITEM_UNAVAILABLE");
  });

  it("creates non-sequential customer-facing references without exposing database IDs", () => {
    const reference = createOrderReference(
      new Date("2026-08-29T12:00:00.000Z"),
      () => Buffer.from("a1b2c3d4", "hex")
    );
    assert.equal(reference, "KK-20260829-A1B2C3D4");
  });
});
