import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  PICKUP_CODE_LETTERS,
  generatePickupCode,
  isValidPickupCode,
  normalizePickupCode,
} from "../lib/pickup/domain.js";
import {
  completePickup,
  markOrderReadyForPickup,
  recordCashReceived,
  verifyPickupCode,
} from "../lib/pickup/service.js";
import {
  assertPickupAttemptAllowed,
  recordPickupFailure,
  resetPickupRateLimitForTests,
} from "../lib/pickup/rate-limit.js";
import { getGoogleAuthStartDecision, getSafeKitchenRedirectPath } from "../lib/auth/redirects.js";

function databaseDouble({ role = "CHEF", status = "PREPARING", paymentStatus = "UNPAID" } = {}) {
  const state = {
    order: {
      id: "order-1",
      reference: "KK-20260830-TEST1",
      userId: "customer-1",
      status,
      paymentMethod: "CASH",
      paymentStatus,
      pickupCode: status === "READY_FOR_PICKUP" ? "A123" : null,
      customerNameSnapshot: "Test Customer",
      customerEmailSnapshot: "private@example.test",
      customerPhoneSnapshot: "+233000000000",
      totalMinor: 4500,
      currency: "GHS",
      items: [{ nameSnapshot: "Chicken Meal", quantity: 2, priceTier: "REGULAR" }],
      payment: { id: "payment-1", method: "CASH", status: paymentStatus },
    },
    history: [],
    paymentUpdates: [],
    orderUpdates: [],
    receipt: null,
    notifications: [],
  };
  const transaction = {
    user: { findUnique: async () => ({ role }) },
    order: {
      findUnique: async ({ where }) => where.reference === state.order.reference ? state.order : null,
      findFirst: async ({ where }) => where.pickupCode === state.order.pickupCode && where.status === state.order.status ? state.order : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.order.id || (where.status && where.status !== state.order.status) || (where.pickupCode !== undefined && where.pickupCode !== state.order.pickupCode) || (where.paymentStatus && where.paymentStatus !== state.order.paymentStatus)) return { count: 0 };
        state.orderUpdates.push(data);
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    payment: {
      findUnique: async ({ where }) => where.id === state.order.payment.id
        ? { id: state.order.payment.id, status: state.order.payment.status, receipt: state.receipt }
        : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.order.payment.id || where.status !== state.order.payment.status) return { count: 0 };
        state.paymentUpdates.push(data);
        Object.assign(state.order.payment, data);
        return { count: 1 };
      },
    },
    receipt: {
      create: async ({ data }) => {
        state.receipt = { id: "receipt-1", ...data, receiptNumber: "KKR-20260830-ABC123" };
        return state.receipt;
      },
    },
    notification: {
      createMany: async ({ data }) => {
        state.notifications.push(...data);
        return { count: data.length };
      },
    },
    orderStatusHistory: { create: async ({ data }) => { state.history.push(data); return data; } },
  };
  return {
    state,
    client: {
      ...transaction,
      $transaction: async (callback) => callback(transaction),
    },
  };
}

describe("pickup-code domain", () => {
  it("normalizes and accepts exactly one safe uppercase letter plus three digits in any position", () => {
    for (const code of ["A123", "1B23", "12C3", "123D"]) assert.equal(isValidPickupCode(code), true, code);
    for (const code of ["AB12", "1234", "A12", "A1234", "I123", "O123", "A12-"]) assert.equal(isValidPickupCode(code), false, code);
    assert.equal(normalizePickupCode(" a 123 "), "A123");
    assert.equal(PICKUP_CODE_LETTERS.includes("I"), false);
    assert.equal(PICKUP_CODE_LETTERS.includes("O"), false);
  });

  it("generates all four letter positions without ambiguous letters", () => {
    for (let position = 0; position < 4; position += 1) {
      const values = [0, 1, 2, 3, position];
      assert.equal(isValidPickupCode(generatePickupCode(() => values.shift())), true);
    }
  });
});

describe("trusted kitchen and pickup lifecycle", () => {
  it("allows CHEF and ADMIN to mark preparing work ready and creates exactly one code", async () => {
    for (const role of ["CHEF", "ADMIN"]) {
      const { client, state } = databaseDouble({ role });
      const result = await markOrderReadyForPickup({ prismaClient: client, actorId: `${role}-1`, reference: state.order.reference, generateCode: () => "1A23" });
      assert.equal(result.pickupCode, "1A23");
      assert.equal(state.order.status, "READY_FOR_PICKUP");
      assert.equal(state.history[0].changedById, `${role}-1`);
      const repeated = await markOrderReadyForPickup({ prismaClient: client, actorId: `${role}-1`, reference: state.order.reference, generateCode: () => "B456" });
      assert.equal(repeated.pickupCode, "1A23");
      assert.equal(repeated.idempotent, true);
    }
  });

  it("retries a unique-code collision without duplicating the order", async () => {
    const { client, state } = databaseDouble();
    const transaction = client.$transaction;
    let attempts = 0;
    client.$transaction = async (callback) => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("unique collision"), { code: "P2002" });
      return transaction(callback);
    };
    const codes = ["A123", "B456"];
    const result = await markOrderReadyForPickup({ prismaClient: client, actorId: "chef-1", reference: state.order.reference, generateCode: () => codes.shift() });
    assert.equal(result.pickupCode, "B456");
    assert.equal(state.history.length, 1);
  });

  it("denies CUSTOMER and never accepts browser role input", async () => {
    const { client, state } = databaseDouble({ role: "CUSTOMER" });
    await assert.rejects(markOrderReadyForPickup({ prismaClient: client, actorId: "customer-1", reference: state.order.reference, generateCode: () => "A123" }), (error) => error.status === 403);
  });

  it("denies the direct CONFIRMED to READY shortcut and creates no pickup code", async () => {
    const { client, state } = databaseDouble({ status: "CONFIRMED" });
    await assert.rejects(
      markOrderReadyForPickup({
        prismaClient: client,
        actorId: "chef-1",
        reference: state.order.reference,
        generateCode: () => "A123",
      }),
      (error) => error.code === "INVALID_ORDER_STATE"
    );
    assert.equal(state.order.status, "CONFIRMED");
    assert.equal(state.order.pickupCode, null);
    assert.equal(state.history.length, 0);
  });

  it("returns no email or phone after generic code verification", async () => {
    const { client } = databaseDouble({ status: "READY_FOR_PICKUP" });
    const result = await verifyPickupCode({ prismaClient: client, actorId: "chef-1", code: "a 123" });
    assert.equal(result.reference, "KK-20260830-TEST1");
    assert.equal(Object.hasOwn(result, "customerEmailSnapshot"), false);
    assert.equal(Object.hasOwn(result, "customerPhoneSnapshot"), false);
    await assert.rejects(verifyPickupCode({ prismaClient: client, actorId: "chef-1", code: "Z999" }), (error) => error.code === "INVALID_PICKUP_CODE" && !/reference|customer/i.test(error.message));
  });

  it("requires payment, records cash idempotently, completes once, and invalidates the code", async () => {
    const { client, state } = databaseDouble({ status: "READY_FOR_PICKUP" });
    await assert.rejects(completePickup({ prismaClient: client, actorId: "chef-1", code: "A123" }), (error) => error.code === "PAYMENT_REQUIRED");
    const payment = await recordCashReceived({ prismaClient: client, actorId: "chef-1", code: "A123" });
    assert.equal(payment.paymentStatus, "PAID");
    assert.equal(state.paymentUpdates[0].cashReceivedById, "chef-1");
    assert.equal(payment.receiptNumber, "KKR-20260830-ABC123");
    const repeatedPayment = await recordCashReceived({ prismaClient: client, actorId: "chef-1", code: "A123" });
    assert.equal(repeatedPayment.idempotent, true);
    const result = await completePickup({ prismaClient: client, actorId: "chef-1", code: "A123" });
    assert.equal(result.status, "COMPLETED");
    assert.equal(state.order.pickupCode, null);
    assert.equal(state.order.pickupCompletedById, "chef-1");
    await assert.rejects(verifyPickupCode({ prismaClient: client, actorId: "chef-1", code: "A123" }), (error) => error.code === "INVALID_PICKUP_CODE");
  });

  it("does not mutate unrelated accepted orders", async () => {
    const { client, state } = databaseDouble({ status: "READY_FOR_PICKUP", paymentStatus: "PAID" });
    await completePickup({ prismaClient: client, actorId: "admin-1", code: "A123" });
    assert.deepEqual(state.orderUpdates.map((update) => Object.keys(update).sort()), [["completedAt", "pickedUpAt", "pickupCode", "pickupCompletedById", "status"].sort()]);
  });

  it("temporarily throttles repeated failed pickup-code attempts", () => {
    resetPickupRateLimitForTests();
    for (let index = 0; index < 8; index += 1) recordPickupFailure("chef-1", 1_000);
    assert.throws(() => assertPickupAttemptAllowed("chef-1", 1_001), (error) => error.status === 429);
    assert.doesNotThrow(() => assertPickupAttemptAllowed("chef-1", 62_000));
  });
});

describe("kitchen UI and authorization wiring", () => {
  it("preserves only safe internal kitchen OAuth intent", () => {
    assert.equal(getSafeKitchenRedirectPath("/kitchen"), "/kitchen");
    assert.equal(getSafeKitchenRedirectPath("https://attacker.example/kitchen"), "/kitchen");
    assert.equal(getSafeKitchenRedirectPath("//attacker.example/kitchen"), "/kitchen");
    assert.deepEqual(getGoogleAuthStartDecision({ intent: "kitchen", intendedPath: "/kitchen" }), {
      intent: "kitchen",
      redirectTo: "/kitchen",
      errorPath: "/kitchen?error=oauth_unavailable",
    });
  });

  it("keeps complete order data visible, pickup code masked for customers, and admin routes isolated", async () => {
    const [kitchenPage, kitchenCard, codeCard, customerPage, adminActions, guard, pickupRoute] = await Promise.all([
      readFile(new URL("../app/kitchen/page.js", import.meta.url), "utf8"),
      readFile(new URL("../components/kitchen/KitchenOrderCard.jsx", import.meta.url), "utf8"),
      readFile(new URL("../components/orders/PickupCodeCard.jsx", import.meta.url), "utf8"),
      readFile(new URL("../app/(customer)/account/orders/[reference]/page.js", import.meta.url), "utf8"),
      readFile(new URL("../components/admin/AdminOrderActions.jsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/auth/guards.js", import.meta.url), "utf8"),
      readFile(new URL("../app/api/pickup/route.js", import.meta.url), "utf8"),
    ]);
    assert.match(kitchenPage, /getKitchenAccess/);
    assert.match(kitchenPage, /PickupVerification/);
    assert.match(kitchenCard, /customerNameSnapshot|pickupName/);
    assert.match(kitchenCard, /Customer note/);
    assert.match(codeCard, /••••/);
    assert.match(codeCard, /Show Code/);
    assert.match(codeCard, /Copy Code/);
    assert.match(customerPage, /order\.status === "READY_FOR_PICKUP" && order\.pickupCode/);
    assert.doesNotMatch(adminActions, /Complete Order/);
    assert.match(guard, /role === "ADMIN" \|\| role === "CHEF"/);
    assert.match(pickupRoute, /role !== "ADMIN" && role !== "CHEF"/);
  });
});
