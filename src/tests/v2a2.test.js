import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDateRangeBounds,
  parseAnalyticsFilters,
  parseOrderFilters,
  parsePaymentFilters,
} from "../lib/admin/filters.js";
import { getOrderingAvailability } from "../lib/admin/ordering-status.js";
import {
  normalizeOrderMetricsRecord,
  summarizeOrderMetrics,
} from "../lib/analytics/order-metrics.js";
import { getAdminAuthorization } from "../lib/auth/authorization.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from "../lib/orders/domain.js";

describe("admin authorization decisions", () => {
  it("routes unauthenticated visitors through the dedicated admin entry", () => {
    assert.deepEqual(getAdminAuthorization(null, null), {
      allowed: false,
      reason: "SIGNED_OUT",
      redirectTo: "/admin",
    });
  });

  it("preserves an intended internal admin destination", () => {
    assert.deepEqual(
      getAdminAuthorization(null, null, "/admin/reviews?status=PENDING"),
      {
        allowed: false,
        reason: "SIGNED_OUT",
        redirectTo:
          "/admin?next=%2Fadmin%2Freviews%3Fstatus%3DPENDING",
      }
    );
  });

  it("denies customers without revealing an admin destination", () => {
    assert.deepEqual(getAdminAuthorization({ id: "customer" }, "CUSTOMER"), {
      allowed: false,
      reason: "FORBIDDEN",
      redirectTo: "/",
    });
  });

  it("allows only an authenticated ADMIN role", () => {
    assert.deepEqual(getAdminAuthorization({ id: "admin" }, "ADMIN"), {
      allowed: true,
      reason: null,
      redirectTo: null,
    });
  });
});

describe("admin filter validation", () => {
  it("accepts supported order and payment filters", () => {
    const { values, errors } = parseOrderFilters({
      search: " KK-204 +233 ",
      orderStatus: ORDER_STATUS.PREPARING,
      paymentMethod: PAYMENT_METHOD.MOBILE_MONEY,
      paymentStatus: PAYMENT_STATUS.PENDING,
      from: "2026-08-01",
      to: "2026-08-23",
      page: "3",
    });

    assert.deepEqual(errors, {});
    assert.equal(values.search, "KK-204 +233");
    assert.equal(values.orderStatus, ORDER_STATUS.PREPARING);
    assert.equal(values.paymentMethod, PAYMENT_METHOD.MOBILE_MONEY);
    assert.equal(values.paymentStatus, PAYMENT_STATUS.PENDING);
    assert.equal(values.page, 3);
  });

  it("ignores unsupported values and sanitizes search syntax", () => {
    const { values, errors } = parsePaymentFilters({
      search: "abc),status.eq.PAID",
      paymentMethod: "CRYPTO",
      paymentStatus: "SUCCESSFUL",
      page: "not-a-page",
    });

    assert.equal(values.search, "abcstatuseqPAID");
    assert.equal(values.paymentMethod, "");
    assert.equal(values.paymentStatus, "");
    assert.equal(values.page, 1);
    assert.ok(errors.paymentMethod);
    assert.ok(errors.paymentStatus);
    assert.ok(errors.page);
  });

  it("rejects impossible and reversed date ranges safely", () => {
    const impossible = parseAnalyticsFilters({ from: "2026-02-30" });
    assert.equal(impossible.values.from, "");
    assert.ok(impossible.errors.from);

    const reversed = parseAnalyticsFilters({
      from: "2026-08-23",
      to: "2026-08-01",
    });
    assert.deepEqual(reversed.values, { from: "", to: "" });
    assert.ok(reversed.errors.dateRange);
  });

  it("uses an inclusive end date through an exclusive next-day bound", () => {
    assert.deepEqual(
      getDateRangeBounds({ from: "2026-08-01", to: "2026-08-23" }),
      {
        fromIso: "2026-08-01T00:00:00.000Z",
        toExclusiveIso: "2026-08-24T00:00:00.000Z",
      }
    );
  });
});

describe("admin metrics and payment breakdown", () => {
  it("returns honest zero metrics for an empty database result", () => {
    const metrics = summarizeOrderMetrics();

    assert.equal(metrics.totalOrders, 0);
    assert.equal(metrics.paidRevenueMinor, 0);
    assert.equal(metrics.unpaidCashValueMinor, 0);
    assert.equal(metrics.averagePaidOrderValueMinor, 0);
    assert.deepEqual(Object.values(metrics.orderStatusCounts), [0, 0, 0, 0, 0, 0]);
  });

  it("calculates status counts, paid revenue and method breakdown correctly", () => {
    const metrics = summarizeOrderMetrics({
      orders: [
        { id: "cash-paid", status: ORDER_STATUS.COMPLETED },
        { id: "cash-unpaid", status: ORDER_STATUS.PREPARING },
        { id: "momo-paid", status: ORDER_STATUS.PENDING },
        { id: "momo-pending", status: ORDER_STATUS.AWAITING_PAYMENT },
        { id: "card-paid", status: ORDER_STATUS.READY_FOR_PICKUP },
        { id: "card-failed", status: ORDER_STATUS.AWAITING_PAYMENT },
        { id: "refunded", status: ORDER_STATUS.CANCELLED },
      ],
      payments: [
        { order_id: "cash-paid", method: PAYMENT_METHOD.CASH, status: PAYMENT_STATUS.PAID, amount_minor: 2000 },
        { order_id: "cash-unpaid", method: PAYMENT_METHOD.CASH, status: PAYMENT_STATUS.UNPAID, amount_minor: 1500 },
        { order_id: "momo-paid", method: PAYMENT_METHOD.MOBILE_MONEY, status: PAYMENT_STATUS.PAID, amount_minor: 3000 },
        { order_id: "momo-pending", method: PAYMENT_METHOD.MOBILE_MONEY, status: PAYMENT_STATUS.PENDING, amount_minor: 2500 },
        { order_id: "card-paid", method: PAYMENT_METHOD.CARD, status: PAYMENT_STATUS.PAID, amount_minor: 4000 },
        { order_id: "card-failed", method: PAYMENT_METHOD.CARD, status: PAYMENT_STATUS.FAILED, amount_minor: 3500 },
        { order_id: "refunded", method: PAYMENT_METHOD.CARD, status: PAYMENT_STATUS.REFUNDED, amount_minor: 5000 },
      ],
    });

    assert.equal(metrics.totalOrders, 7);
    assert.equal(metrics.orderStatusCounts.AWAITING_PAYMENT, 2);
    assert.equal(metrics.orderStatusCounts.COMPLETED, 1);
    assert.equal(metrics.orderStatusCounts.CANCELLED, 1);
    assert.equal(metrics.paidRevenueMinor, 9000);
    assert.equal(metrics.paidOrderCount, 3);
    assert.equal(metrics.averagePaidOrderValueMinor, 3000);
    assert.equal(metrics.paymentSummary.cashPaidMinor, 2000);
    assert.equal(metrics.paymentSummary.cashUnpaidMinor, 1500);
    assert.equal(metrics.paymentSummary.cashUnpaidCount, 1);
    assert.equal(metrics.paymentSummary.mobileMoneyPaidMinor, 3000);
    assert.equal(metrics.paymentSummary.cardPaidMinor, 4000);
    assert.equal(metrics.paymentSummary.pendingElectronicCount, 1);
    assert.equal(metrics.paymentSummary.failedElectronicCount, 1);
  });

  it("normalizes an empty database aggregate without inventing values", () => {
    const metrics = normalizeOrderMetricsRecord();

    assert.equal(metrics.totalOrders, 0);
    assert.equal(metrics.paidRevenueMinor, 0);
    assert.deepEqual(metrics.orderCountByDay, []);
    assert.deepEqual(metrics.revenueByDay, []);
    assert.deepEqual(metrics.topItems, []);
  });
});

describe("build availability versus kitchen operations", () => {
  it("does not let accepting_orders bypass a disabled build flag", () => {
    const status = getOrderingAvailability({
      featureEnabled: false,
      acceptingOrders: true,
    });

    assert.equal(status.code, "BUILD_DISABLED");
    assert.equal(status.available, false);
  });

  it("distinguishes a paused kitchen from an accepting kitchen", () => {
    assert.equal(
      getOrderingAvailability({ featureEnabled: true, acceptingOrders: false }).code,
      "KITCHEN_PAUSED"
    );
    assert.equal(
      getOrderingAvailability({ featureEnabled: true, acceptingOrders: true }).code,
      "ACCEPTING_ORDERS"
    );
  });
});
