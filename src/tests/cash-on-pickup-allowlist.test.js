import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  getPaymentAvailability,
  isCashOnPickupAllowedForEmail,
  parseCashOnPickupAllowedEmails,
} from "../lib/payments/domain.js";

describe("Cash on Pickup account allowlist", () => {
  it("fails closed when configuration is absent or empty", () => {
    assert.equal(isCashOnPickupAllowedForEmail("customer@example.test", undefined), false);
    assert.equal(isCashOnPickupAllowedForEmail("customer@example.test", "  ,  "), false);
  });

  it("normalizes, deduplicates, and ignores malformed entries", () => {
    assert.deepEqual(
      parseCashOnPickupAllowedEmails(
        " AMA@Example.Test, ama@example.test, , invalid, esi@example.test "
      ),
      ["ama@example.test", "esi@example.test"]
    );
    assert.equal(
      isCashOnPickupAllowedForEmail(
        "  Ama@EXAMPLE.test ",
        "ama@example.test, esi@example.test"
      ),
      true
    );
    assert.equal(
      isCashOnPickupAllowedForEmail(
        "other@example.test",
        "ama@example.test, esi@example.test"
      ),
      false
    );
  });

  it("allows Cash only for the trusted email while leaving Paystack selectable", () => {
    const previous = {
      secret: process.env.PAYSTACK_SECRET_KEY,
      enabled: process.env.PAYSTACK_ENABLED,
      required: process.env.ONLINE_PAYMENT_REQUIRED,
      cash: process.env.CASH_ON_PICKUP_ALLOWED_EMAILS,
    };
    try {
      process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
      process.env.PAYSTACK_ENABLED = "true";
      process.env.ONLINE_PAYMENT_REQUIRED = "true";
      process.env.CASH_ON_PICKUP_ALLOWED_EMAILS = "allowed@example.test";

      assert.deepEqual(
        getPaymentAvailability({ customerEmail: "normal@example.test" }).methods,
        { CASH: false, MOBILE_MONEY: true, CARD: true }
      );
      assert.deepEqual(
        getPaymentAvailability({ customerEmail: "ALLOWED@example.test" }).methods,
        { CASH: true, MOBILE_MONEY: true, CARD: true }
      );
    } finally {
      for (const [name, value] of [
        ["PAYSTACK_SECRET_KEY", previous.secret],
        ["PAYSTACK_ENABLED", previous.enabled],
        ["ONLINE_PAYMENT_REQUIRED", previous.required],
        ["CASH_ON_PICKUP_ALLOWED_EMAILS", previous.cash],
      ]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("uses authenticated identities in both checkout presentation and submission", async () => {
    const [page, route, service] = await Promise.all([
      readFile("src/app/(customer)/checkout/page.js", "utf8"),
      readFile("src/app/api/orders/route.js", "utf8"),
      readFile("src/lib/orders/checkout-service.js", "utf8"),
    ]);

    assert.match(page, /getPaymentAvailability\(\{ customerEmail: user\.email \}\)/);
    assert.match(route, /getPaymentAvailability\(\{ customerEmail: user\.email \}\)/);
    assert.doesNotMatch(route, /getPaymentAvailability\(\{ customerEmail: payload/);
    assert.match(service, /customerEmail: trustedUser\.email/);
  });

  it("documents only a blank server-side setting", async () => {
    const example = await readFile(".env.example", "utf8");
    assert.match(example, /^CASH_ON_PICKUP_ALLOWED_EMAILS=$/m);
    assert.doesNotMatch(example, /CASH_ON_PICKUP_ALLOWED_EMAILS=\S+/);
  });
});
