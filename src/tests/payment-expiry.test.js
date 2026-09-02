import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { CUSTOMER_ACTIVE_ORDER_STATUSES } from "../lib/orders/customer-active.js";
import { expireAbandonedPaystackOrders } from "../lib/payments/expiry.js";
import {
  isPaymentExpiredOrder,
  isWithinPaymentWindow,
  LATE_PAYSTACK_PAYMENT_REASON,
  PAYMENT_EXPIRED_MESSAGE,
  PAYMENT_EXPIRED_REASON,
  PAYMENT_WINDOW_MS,
} from "../lib/payments/expiry-policy.js";
import {
  finalizeVerifiedPaystackPayment,
  retryPaystackPayment,
} from "../lib/payments/service.js";

function finalizationDouble({ createdAt, status = "AWAITING_PAYMENT" }) {
  const state = {
    order: {
      id: "order-1",
      reference: "KK-20260902-EXP001",
      userId: "customer-1",
      status,
      paymentStatus: status === "CANCELLED" ? "FAILED" : "PENDING",
      cancellationReason: status === "CANCELLED" ? PAYMENT_EXPIRED_REASON : null,
      cancelledAt: status === "CANCELLED" ? new Date("2026-09-02T12:15:00Z") : null,
      createdAt,
    },
    payment: {
      id: "payment-1",
      method: "CARD",
      status: status === "CANCELLED" ? "FAILED" : "PENDING",
      amountMinor: 7500,
      currency: "GHS",
      receipt: null,
    },
    attempt: {
      id: "attempt-1",
      provider: "PAYSTACK",
      providerRef: "KKP-expiry-reference-1",
      amountMinor: 7500,
      currency: "GHS",
      status: "PENDING",
    },
    receiptCreates: 0,
    notifications: [],
  };
  const attemptRecord = () => ({
    ...state.attempt,
    payment: { ...state.payment, receipt: state.payment.receipt, order: state.order },
  });
  const transaction = {
    user: {
      findMany: async ({ where }) => where.role === "ADMIN" ? [{ id: "admin-1" }] : [],
    },
    notification: {
      createMany: async ({ data }) => {
        state.notifications.push(...data);
        return { count: data.length };
      },
    },
    paymentAttempt: {
      findUnique: async () => attemptRecord(),
      update: async ({ data }) => Object.assign(state.attempt, data),
    },
    payment: {
      findUnique: async () => ({
        id: state.payment.id,
        status: state.payment.status,
        receipt: state.payment.receipt,
      }),
      update: async ({ data }) => Object.assign(state.payment, data),
    },
    order: {
      updateMany: async ({ data }) => {
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    receipt: {
      create: async ({ data }) => {
        state.receiptCreates += 1;
        state.payment.receipt = { id: "receipt-1", ...data };
        return state.payment.receipt;
      },
    },
  };
  return {
    state,
    client: {
      paymentAttempt: { findUnique: async () => attemptRecord() },
      $transaction: async (callback) => callback(transaction),
    },
  };
}

const verifiedAt = (paidAt) => ({
  id: "90071992547409931234",
  reference: "KKP-expiry-reference-1",
  status: "success",
  amount: 7500,
  currency: "GHS",
  channel: "card",
  paid_at: paidAt.toISOString(),
});

describe("unpaid Paystack order expiry", () => {
  it("keeps retry valid before 15 minutes and expires at the exact boundary", () => {
    const createdAt = new Date("2026-09-02T12:00:00Z");
    assert.equal(
      isWithinPaymentWindow(createdAt, new Date(createdAt.getTime() + PAYMENT_WINDOW_MS - 1)),
      true
    );
    assert.equal(
      isWithinPaymentWindow(createdAt, new Date(createdAt.getTime() + PAYMENT_WINDOW_MS)),
      false
    );
  });

  it("expires only awaiting Paystack methods and leaves Cash outside the mutation scope", async () => {
    const calls = [];
    const prismaClient = {
      paymentAttempt: {
        updateMany: async (args) => {
          calls.push(["attempt", args]);
          return { count: 1 };
        },
      },
      receipt: {
        create: async () => {
          throw new Error("Expiry must not issue a receipt.");
        },
      },
      payment: {
        updateMany: async (args) => {
          calls.push(["payment", args]);
          return { count: 1 };
        },
      },
      order: {
        updateMany: async (args) => {
          calls.push(["order", args]);
          return { count: 1 };
        },
      },
      $transaction: async (operations) => Promise.all(operations),
    };
    const now = new Date("2026-09-02T12:15:00Z");
    const result = await expireAbandonedPaystackOrders({ prismaClient, now });
    assert.deepEqual(result, {
      expiredOrders: 1,
      failedPayments: 1,
      abandonedAttempts: 1,
    });
    assert.equal(calls[0][1].data.status, "ABANDONED");
    assert.deepEqual(calls[1][1].where.method.in, ["MOBILE_MONEY", "CARD"]);
    assert.deepEqual(calls[2][1].where.paymentMethod.in, ["MOBILE_MONEY", "CARD"]);
    assert.equal(calls[2][1].where.paymentMethod.in.includes("CASH"), false);
    assert.equal(calls[2][1].data.status, "CANCELLED");
    assert.equal(calls[2][1].data.cancellationReason, PAYMENT_EXPIRED_REASON);
    assert.equal(Object.hasOwn(calls[2][1].data, "pickupCode"), false);
  });

  it("rejects a manipulated retry after lazy expiry without creating an attempt", async () => {
    const order = {
      id: "order-1",
      reference: "KK-20260902-EXP001",
      userId: "customer-1",
      status: "AWAITING_PAYMENT",
      paymentStatus: "FAILED",
      paymentMethod: "CARD",
      cancellationReason: null,
      payment: {
        id: "payment-1",
        status: "FAILED",
        amountMinor: 7500,
        currency: "GHS",
        attempts: [{ status: "FAILED" }],
      },
      user: { email: "customer@example.test", role: "CUSTOMER" },
    };
    let attemptCreates = 0;
    const transaction = {
      order: { findFirst: async () => order },
      paymentAttempt: { create: async () => { attemptCreates += 1; } },
    };
    const prismaClient = {
      $transaction: async (callback) => callback(transaction),
    };

    await assert.rejects(
      retryPaystackPayment({
        prismaClient,
        userId: order.userId,
        orderReference: order.reference,
        assertOrderingOpen: async () => ({ acceptingOrders: true }),
        expireOrders: async () => {
          order.status = "CANCELLED";
          order.cancellationReason = PAYMENT_EXPIRED_REASON;
          return { expiredOrders: 1, failedPayments: 0 };
        },
      }),
      (error) =>
        error.code === "PAYMENT_EXPIRED" &&
        error.status === 409 &&
        error.message === PAYMENT_EXPIRED_MESSAGE
    );
    assert.equal(attemptCreates, 0);
  });

  it("revives an on-time verified payment that raced with expiry", async () => {
    const createdAt = new Date("2026-09-02T12:00:00Z");
    const { client, state } = finalizationDouble({ createdAt, status: "CANCELLED" });
    const result = await finalizeVerifiedPaystackPayment({
      prismaClient: client,
      reference: state.attempt.providerRef,
      verified: verifiedAt(new Date("2026-09-02T12:14:59.999Z")),
      now: new Date("2026-09-02T12:15:01Z"),
      generateReceiptNumber: () => "KKR-20260902-RACE01",
    });
    assert.equal(state.payment.status, "PAID");
    assert.equal(state.order.status, "PENDING");
    assert.equal(state.order.cancellationReason, null);
    assert.equal(result.requiresAdminReconciliation, false);
  });

  it("records a genuinely late success once and keeps it out of the kitchen", async () => {
    const createdAt = new Date("2026-09-02T12:00:00Z");
    const { client, state } = finalizationDouble({ createdAt, status: "CANCELLED" });
    const options = {
      prismaClient: client,
      reference: state.attempt.providerRef,
      verified: verifiedAt(new Date("2026-09-02T12:15:00Z")),
      now: new Date("2026-09-02T12:16:00Z"),
      generateReceiptNumber: () => "KKR-20260902-LATE01",
    };
    const first = await finalizeVerifiedPaystackPayment(options);
    const duplicate = await finalizeVerifiedPaystackPayment(options);
    assert.equal(state.payment.status, "PAID");
    assert.equal(state.order.status, "CANCELLED");
    assert.equal(state.order.cancellationReason, LATE_PAYSTACK_PAYMENT_REASON);
    assert.equal(state.receiptCreates, 1);
    assert.equal(first.requiresAdminReconciliation, true);
    assert.equal(duplicate.idempotent, true);
    assert.equal(duplicate.requiresAdminReconciliation, true);
  });

  it("keeps expired orders in customer history with safe copy and Order Again", async () => {
    const [detailPage, listPage, adminOrders, kitchenOrders] = await Promise.all([
      readFile("src/app/(customer)/account/orders/[reference]/page.js", "utf8"),
      readFile("src/app/(customer)/account/orders/page.js", "utf8"),
      readFile("src/lib/admin/orders.js", "utf8"),
      readFile("src/lib/kitchen/orders.js", "utf8"),
    ]);
    assert.equal(CUSTOMER_ACTIVE_ORDER_STATUSES.includes("AWAITING_PAYMENT"), false);
    assert.equal(CUSTOMER_ACTIVE_ORDER_STATUSES.includes("CANCELLED"), false);
    assert.match(detailPage, /Payment Expired/);
    assert.match(detailPage, /OrderAgainButton/);
    assert.match(listPage, /Payment Expired/);
    assert.match(adminOrders, /HISTORY_ORDER_STATUSES[\s\S]*ORDER_STATUS\.CANCELLED/);
    assert.doesNotMatch(
      adminOrders.match(/const ACTIVE_ORDER_STATUSES = \[[\s\S]*?\];/)?.[0] || "",
      /AWAITING_PAYMENT/
    );
    assert.doesNotMatch(kitchenOrders, /AWAITING_PAYMENT/);
    assert.equal(
      isPaymentExpiredOrder({ status: "CANCELLED", cancellationReason: PAYMENT_EXPIRED_REASON }),
      true
    );
  });
});
