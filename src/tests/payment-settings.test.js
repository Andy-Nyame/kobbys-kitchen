import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  AdminPaymentSettingError,
  executeCashOnPickupSettingUpdate,
  prepareCashOnPickupSetting,
} from "../lib/admin/payment-settings.js";
import {
  assertPaymentMethodAvailable,
  getPaymentAvailability,
} from "../lib/payments/domain.js";

function fakeSettingsPrisma(role) {
  const state = { cashOnPickupEnabled: false, changedById: null };
  const transaction = {
    user: {
      findUnique: async () => role ? { role } : null,
    },
    orderingSetting: {
      upsert: async ({ update, create }) => {
        Object.assign(state, state.changedById === null ? create : update);
        return {
          cashOnPickupEnabled: state.cashOnPickupEnabled,
          updatedAt: new Date("2026-09-23T12:00:00.000Z"),
        };
      },
    },
  };
  return {
    state,
    $transaction: async (callback) => callback(transaction),
  };
}

describe("Cash on Pickup store setting", () => {
  it("validates only an explicit boolean setting", () => {
    assert.deepEqual(prepareCashOnPickupSetting({ cashOnPickupEnabled: true }), {
      cashOnPickupEnabled: true,
    });
    assert.throws(() => prepareCashOnPickupSetting({ cashOnPickupEnabled: "true" }), TypeError);
    assert.throws(() => prepareCashOnPickupSetting(null), TypeError);
  });

  it("lets an Admin enable and disable the persisted setting", async () => {
    const prisma = fakeSettingsPrisma("ADMIN");
    const enabled = await executeCashOnPickupSettingUpdate({
      prismaClient: prisma,
      adminUserId: "admin-1",
      cashOnPickupEnabled: true,
    });
    assert.equal(enabled.cashOnPickupEnabled, true);
    assert.equal(prisma.state.changedById, "admin-1");

    const disabled = await executeCashOnPickupSettingUpdate({
      prismaClient: prisma,
      adminUserId: "admin-1",
      cashOnPickupEnabled: false,
    });
    assert.equal(disabled.cashOnPickupEnabled, false);
  });

  it("denies Customer and unauthenticated setting mutations", async () => {
    for (const role of ["CUSTOMER", null]) {
      const prisma = fakeSettingsPrisma(role);
      await assert.rejects(
        executeCashOnPickupSettingUpdate({
          prismaClient: prisma,
          adminUserId: "not-admin",
          cashOnPickupEnabled: true,
        }),
        (error) => error instanceof AdminPaymentSettingError && error.status === 403
      );
      assert.equal(prisma.state.cashOnPickupEnabled, false);
    }
  });

  it("requires both the store switch and account allowlist while preserving Paystack", () => {
    const previous = {
      secret: process.env.PAYSTACK_SECRET_KEY,
      enabled: process.env.PAYSTACK_ENABLED,
      cash: process.env.CASH_ON_PICKUP_ALLOWED_EMAILS,
    };
    try {
      process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
      process.env.PAYSTACK_ENABLED = "true";
      process.env.CASH_ON_PICKUP_ALLOWED_EMAILS = "allowed@example.test";

      const disabled = getPaymentAvailability({
        customerEmail: "allowed@example.test",
        cashOnPickupEnabled: false,
      });
      assert.deepEqual(disabled.methods, {
        CASH: false,
        MOBILE_MONEY: true,
        CARD: true,
      });
      assert.throws(
        () => assertPaymentMethodAvailable("CASH", disabled),
        /currently unavailable/
      );

      const allowed = getPaymentAvailability({
        customerEmail: "ALLOWED@example.test",
        cashOnPickupEnabled: true,
      });
      assert.equal(allowed.methods.CASH, true);

      const ineligible = getPaymentAvailability({
        customerEmail: "normal@example.test",
        cashOnPickupEnabled: true,
      });
      assert.equal(ineligible.methods.CASH, false);
      assert.throws(
        () => assertPaymentMethodAvailable("CASH", ineligible),
        /unavailable for this account/
      );
    } finally {
      for (const [name, value] of [
        ["PAYSTACK_SECRET_KEY", previous.secret],
        ["PAYSTACK_ENABLED", previous.enabled],
        ["CASH_ON_PICKUP_ALLOWED_EMAILS", previous.cash],
      ]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("wires the persisted setting into Admin, Checkout, and server enforcement", async () => {
    const [adminPage, adminRoute, checkoutPage, checkoutRoute, server, migration] = await Promise.all([
      readFile("src/app/admin/settings/page.js", "utf8"),
      readFile("src/app/api/admin/payment-settings/route.js", "utf8"),
      readFile("src/app/(customer)/checkout/page.js", "utf8"),
      readFile("src/app/api/orders/route.js", "utf8"),
      readFile("src/lib/orders/server.js", "utf8"),
      readFile("prisma/migrations/20260923120000_add_cash_on_pickup_setting/migration.sql", "utf8"),
    ]);

    assert.match(adminPage, /AdminCashOnPickupSetting/);
    assert.match(adminRoute, /getAdminAuthorization/);
    assert.match(adminRoute, /revalidatePath\("\/checkout"\)/);
    assert.match(checkoutPage, /getCurrentPaymentAvailability/);
    assert.match(checkoutRoute, /await getCurrentPaymentAvailability/);
    assert.match(server, /resolvePaymentAvailability: getCurrentPaymentAvailability/);
    assert.match(migration, /DEFAULT false/);
  });
});
