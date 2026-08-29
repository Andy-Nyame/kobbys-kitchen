import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { summarizeOrderMetrics } from "../lib/analytics/order-metrics.js";
import { isOrderingEnabled } from "../lib/feature-flags.js";
import {
  assertMinorAmount,
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  getInitialOrderPaymentState,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from "../lib/orders/domain.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.join(testDirectory, "../..");
const originalOrderingFlag = process.env.V2_ORDERING_ENABLED;

afterEach(() => {
  if (originalOrderingFlag === undefined) {
    delete process.env.V2_ORDERING_ENABLED;
  } else {
    process.env.V2_ORDERING_ENABLED = originalOrderingFlag;
  }
});

describe("initial order and payment state", () => {
  it("starts cash orders as pending and unpaid", () => {
    assert.deepEqual(getInitialOrderPaymentState(PAYMENT_METHOD.CASH), {
      orderStatus: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.UNPAID,
    });
  });

  it("awaits verified payment for mobile money and card", () => {
    for (const method of [PAYMENT_METHOD.MOBILE_MONEY, PAYMENT_METHOD.CARD]) {
      assert.deepEqual(getInitialOrderPaymentState(method), {
        orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
        paymentStatus: PAYMENT_STATUS.PENDING,
      });
    }
  });

  it("fails closed for unsupported payment methods", () => {
    assert.throws(() => getInitialOrderPaymentState("CRYPTO"), TypeError);
    assert.throws(() => getInitialOrderPaymentState(null), TypeError);
  });
});

describe("state transition rules", () => {
  it("allows only the intended forward order flow and cancellation", () => {
    assert.equal(
      canTransitionOrderStatus(
        ORDER_STATUS.AWAITING_PAYMENT,
        ORDER_STATUS.PENDING
      ),
      true
    );
    assert.equal(
      canTransitionOrderStatus(ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED),
      true
    );
    assert.equal(
      canTransitionOrderStatus(ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING),
      true
    );
    assert.equal(
      canTransitionOrderStatus(
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY_FOR_PICKUP
      ),
      true
    );
    assert.equal(
      canTransitionOrderStatus(
        ORDER_STATUS.READY_FOR_PICKUP,
        ORDER_STATUS.COMPLETED
      ),
      true
    );
    assert.equal(
      canTransitionOrderStatus(ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED),
      true
    );
    assert.equal(
      canTransitionOrderStatus(ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PREPARING),
      false
    );
  });

  it("keeps completed and cancelled orders terminal", () => {
    for (const terminalStatus of [
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.CANCELLED,
    ]) {
      for (const nextStatus of Object.values(ORDER_STATUS)) {
        assert.equal(
          canTransitionOrderStatus(terminalStatus, nextStatus),
          false
        );
      }
    }
  });

  it("models payment verification, retry, cash collection, and refund flows", () => {
    assert.equal(
      canTransitionPaymentStatus(PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PAID),
      true
    );
    assert.equal(
      canTransitionPaymentStatus(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID),
      true
    );
    assert.equal(
      canTransitionPaymentStatus(PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED),
      true
    );
    assert.equal(
      canTransitionPaymentStatus(PAYMENT_STATUS.FAILED, PAYMENT_STATUS.PENDING),
      true
    );
    assert.equal(
      canTransitionPaymentStatus(PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED),
      true
    );
    assert.equal(
      canTransitionPaymentStatus(PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PAID),
      false
    );
  });
});

describe("money and revenue semantics", () => {
  it("accepts only non-negative safe integer minor units", () => {
    assert.equal(assertMinorAmount(2550), 2550);
    for (const value of [-1, 25.5, Number.MAX_SAFE_INTEGER + 1, "2550"]) {
      assert.throws(() => assertMinorAmount(value), TypeError);
    }
  });

  it("counts only logical paid payments as revenue", () => {
    const metrics = summarizeOrderMetrics({
      orders: [
        { id: "cash-paid", status: ORDER_STATUS.COMPLETED },
        { id: "momo-paid", status: ORDER_STATUS.PENDING },
        { id: "cash-unpaid", status: ORDER_STATUS.PREPARING },
        { id: "cash-cancelled", status: ORDER_STATUS.CANCELLED },
        { id: "card-failed", status: ORDER_STATUS.AWAITING_PAYMENT },
      ],
      payments: [
        { order_id: "cash-paid", method: PAYMENT_METHOD.CASH, status: PAYMENT_STATUS.PAID, amount_minor: 2500 },
        { order_id: "momo-paid", method: PAYMENT_METHOD.MOBILE_MONEY, status: PAYMENT_STATUS.PAID, amount_minor: 5000 },
        { order_id: "cash-unpaid", method: PAYMENT_METHOD.CASH, status: PAYMENT_STATUS.UNPAID, amount_minor: 1800 },
        { order_id: "cash-cancelled", method: PAYMENT_METHOD.CASH, status: PAYMENT_STATUS.UNPAID, amount_minor: 900 },
        { order_id: "card-failed", method: PAYMENT_METHOD.CARD, status: PAYMENT_STATUS.FAILED, amount_minor: 3000 },
      ],
    });

    assert.equal(metrics.totalOrders, 5);
    assert.equal(metrics.paidOrderCount, 2);
    assert.equal(metrics.paidRevenueMinor, 7500);
    assert.equal(metrics.revenueByPaymentMethodMinor.CASH, 2500);
    assert.equal(metrics.revenueByPaymentMethodMinor.MOBILE_MONEY, 5000);
    assert.equal(metrics.revenueByPaymentMethodMinor.CARD, 0);
    assert.equal(metrics.unpaidCashValueMinor, 1800);
    assert.equal(metrics.averagePaidOrderValueMinor, 3750);
  });

  it("rejects duplicate logical payments instead of double-counting revenue", () => {
    assert.throws(
      () =>
        summarizeOrderMetrics({
          payments: [
            { order_id: "one-order", method: PAYMENT_METHOD.CARD, status: PAYMENT_STATUS.PAID, amount_minor: 1000 },
            { order_id: "one-order", method: PAYMENT_METHOD.CARD, status: PAYMENT_STATUS.PAID, amount_minor: 1000 },
          ],
        }),
      /Multiple logical payments/
    );
  });
});

describe("disabled ordering and database security contracts", () => {
  const schema = fs.readFileSync(
    path.join(
      rootDirectory,
      "prisma/schema.prisma"
    ),
    "utf8"
  );
  const constraints = fs.readFileSync(
    path.join(
      rootDirectory,
      "prisma/migrations/20260827140000_align_domain_constraints/migration.sql"
    ),
    "utf8"
  );

  it("keeps ordering disabled by default", () => {
    delete process.env.V2_ORDERING_ENABLED;
    assert.equal(isOrderingEnabled(), false);
  });

  it("keeps payment mutation out of the public application API", () => {
    assert.equal(
      fs.existsSync(path.join(rootDirectory, "src/app/api/payments/route.js")),
      false
    );
  });

  it("preserves trusted-server-only order creation behind the ordering guard", () => {
    const orderRoute = fs.readFileSync(
      path.join(rootDirectory, "src/app/api/orders/route.js"),
      "utf8"
    );
    const checkoutService = fs.readFileSync(
      path.join(rootDirectory, "src/lib/orders/checkout-service.js"),
      "utf8"
    );

    assert.match(orderRoute, /createPickupOrderForCustomer/);
    assert.match(orderRoute, /getAuthenticatedUser/);
    assert.match(orderRoute, /getUserRole/);
    assert.match(checkoutService, /await assertOrderingOpen\(\{ client: transaction \}\)/);
    assert.match(checkoutService, /transaction\.menuItem\.findMany/);
  });

  it("enforces one payment per order and unique retry identifiers", () => {
    assert.match(schema, /orderId\s+String\s+@unique\s+@db\.Uuid/);
    assert.match(schema, /@@unique\(\[userId, idempotencyKey\]\)/);
    assert.match(constraints, /CREATE UNIQUE INDEX "payments_orderId_key"/);
  });
});
