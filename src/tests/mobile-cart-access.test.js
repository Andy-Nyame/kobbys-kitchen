import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  formatGhs,
  getCartItemCount,
  getCartSubtotalMinor,
} from "../lib/cart/domain.js";
import {
  isMobileCartCtaSuppressedPath,
  shouldShowMobileCartCta,
} from "../lib/cart/mobile-cart.js";

const itemId = "11111111-1111-4111-8111-111111111111";
const catalogue = [
  { id: itemId, priceMinor: 3000, priceStepMinor: 1000, available: true },
];

describe("mobile cart access", () => {
  it("uses total item quantity and the existing tier-aware Cart total", () => {
    const lines = [
      { menuItemId: itemId, priceTier: 0, quantity: 2 },
      { menuItemId: itemId, priceTier: 1, quantity: 1 },
    ];

    assert.equal(getCartItemCount(lines), 3);
    assert.equal(formatGhs(getCartSubtotalMinor(lines, catalogue)), "GH₵100.00");
  });

  it("shows only for a non-empty cart on appropriate shopping surfaces", () => {
    assert.equal(shouldShowMobileCartCta("/", 1), true);
    assert.equal(shouldShowMobileCartCta("/menu", 3), true);
    assert.equal(shouldShowMobileCartCta("/about", 1), true);
    assert.equal(shouldShowMobileCartCta("/menu", 0), false);
    assert.equal(shouldShowMobileCartCta("/menu", -1), false);

    for (const path of [
      "/cart",
      "/checkout",
      "/account/orders",
      "/admin",
      "/kitchen",
      "/login",
      "/auth/callback",
      "/payment/callback",
    ]) {
      assert.equal(isMobileCartCtaSuppressedPath(path), true, path);
      assert.equal(shouldShowMobileCartCta(path, 2), false, path);
    }
  });

  it("renders one reactive, accessible Cart CTA from the shared provider", async () => {
    const [cta, link, layout, navigation, header] = await Promise.all([
      readFile("src/components/cart/MobileCartCta.jsx", "utf8"),
      readFile("src/components/cart/CartLink.jsx", "utf8"),
      readFile("src/app/(marketing)/layout.js", "utf8"),
      readFile("src/components/navigation/MobileNavigation.jsx", "utf8"),
      readFile("src/components/layout/SiteHeader.jsx", "utf8"),
    ]);

    assert.match(cta, /useCart\(\)/);
    assert.match(cta, /getCartSubtotalMinor\(lines, catalogueItems\)/);
    assert.match(cta, /shouldShowMobileCartCta\(pathname, itemCount\)/);
    assert.match(cta, /aria-label=\{`View cart, \$\{itemLabel\}, \$\{total\}`\}/);
    assert.match(cta, /href="\/cart"/);
    assert.match(layout, /<MobileCartCta catalogueItems=\{cartCatalogueItems\} \/>/);
    assert.match(link, /itemCount > 0/);
    assert.match(link, /`Cart, \$\{itemLabel\}`/);
    assert.match(header, /<CartLink mobileHeader \/>/);
    assert.doesNotMatch(navigation, /CartLink/);
  });

  it("uses mobile safe-area spacing, theme tokens, and reduced-motion protection", async () => {
    const css = await readFile("src/app/globals.css", "utf8");

    assert.match(css, /bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom, 0px\)\)/);
    assert.match(css, /mobile-cart-cta-spacer[\s\S]*safe-area-inset-bottom/);
    assert.match(css, /mobile-cart-cta[\s\S]*var\(--color-brand-yellow\)/);
    assert.match(css, /@keyframes mobile-cart-cta-in/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0ms !important/);
    assert.match(css, /mobile-cart-cta-shell,[\s\S]*display: none/);
    assert.match(css, /@media \(max-width: 1023px\)[\s\S]*mobile-cart-cta-shell[\s\S]*display: block/);
  });

  it("keeps the CTA out of Admin/Kitchen and removes it when checkout clears Cart", async () => {
    const [adminLayout, kitchen, checkout, paymentResult] = await Promise.all([
      readFile("src/app/admin/layout.js", "utf8"),
      readFile("src/app/kitchen/page.js", "utf8"),
      readFile("src/components/checkout/CheckoutForm.jsx", "utf8"),
      readFile("src/components/payments/PaymentResultActions.jsx", "utf8"),
    ]);

    assert.doesNotMatch(adminLayout, /MobileCartCta/);
    assert.doesNotMatch(kitchen, /MobileCartCta/);
    assert.match(checkout, /clearCart\(\)/);
    assert.match(paymentResult, /clearCart\(\)/);
  });
});
