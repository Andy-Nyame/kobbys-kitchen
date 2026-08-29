import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  deriveMenuPriceMinor,
  getApprovedBackfillPriceStepMinor,
} from "../lib/menu/pricing.js";

describe("server-authoritative menu price tiers", () => {
  it("derives GH₵30 tiers in GH₵10 steps", () => {
    const item = { priceMinor: 3000, priceStepMinor: 1000 };
    assert.deepEqual([0, 1, 2].map((tier) => deriveMenuPriceMinor(item, tier)), [3000, 4000, 5000]);
  });

  it("derives GH₵25 tiers in GH₵5 steps", () => {
    const item = { priceMinor: 2500, priceStepMinor: 500 };
    assert.deepEqual([0, 1, 2].map((tier) => deriveMenuPriceMinor(item, tier)), [2500, 3000, 3500]);
  });

  it("rejects arbitrary browser prices, malformed tiers, and invalid increments", () => {
    const item = { priceMinor: 3000, priceStepMinor: 1000, selectedPrice: 999999 };
    assert.equal(deriveMenuPriceMinor(item, 1), 4000);
    assert.equal(deriveMenuPriceMinor(item, -1), null);
    assert.equal(deriveMenuPriceMinor(item, 1.5), null);
    assert.equal(deriveMenuPriceMinor({ priceMinor: 3000, priceStepMinor: 0 }, 1), null);
  });

  it("matches only the approved migration convention", () => {
    assert.equal(getApprovedBackfillPriceStepMinor(3000), 1000);
    assert.equal(getApprovedBackfillPriceStepMinor(2500), 500);
    assert.equal(getApprovedBackfillPriceStepMinor(2750), null);
  });

  it("exposes starting price/increment to ADMIN and an accessible public stepper", async () => {
    const [adminMenu, publicCard] = await Promise.all([
      readFile("src/components/admin/AdminMenuManager.jsx", "utf8"),
      readFile("src/components/cart/MenuItemCard.jsx", "utf8"),
    ]);
    assert.match(adminMenu, /Starting Price/);
    assert.match(adminMenu, /Price Increment/);
    assert.match(publicCard, /From \{formatGhs\(item\.priceMinor\)\}/);
    assert.match(publicCard, /Lower \$\{item\.name\} amount/);
    assert.match(publicCard, /Raise \$\{item\.name\} amount/);
  });
});
