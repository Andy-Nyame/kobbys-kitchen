import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { buildRegistrationTrend, getRegistrationBounds } from "../lib/analytics/account-metrics.js";
import { summarizeOrderMetrics } from "../lib/analytics/order-metrics.js";

describe("account analytics", () => {
  it("uses deterministic GMT registration ranges and truthful zero days", () => {
    const now = new Date("2026-08-28T17:00:00Z");
    const bounds = getRegistrationBounds(now);
    assert.equal(bounds.today.toISOString(), "2026-08-28T00:00:00.000Z");
    const trend = buildRegistrationTrend(["2026-08-23T10:00:00Z", "2026-08-28T01:00:00Z"], now);
    assert.deepEqual(trend.map((item) => item.count), [0, 1, 0, 0, 0, 0, 1]);
  });

  it("keeps main Analytics account-focused and money inside Orders", async () => {
    const [analytics, orders, payments] = await Promise.all([
      readFile(new URL("../app/admin/analytics/page.js", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/orders/page.js", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/payments/page.js", import.meta.url), "utf8"),
    ]);
    assert.match(analytics, /Account Analytics/);
    assert.doesNotMatch(analytics, /Paid revenue|Gross order value|Average order value/);
    assert.match(orders, /New Orders/);
    assert.match(orders, /In Progress/);
    assert.match(orders, /History/);
    assert.match(orders, /Revenue & Analytics/);
    assert.match(payments, /Payment/);
  });
});

describe("order analytics semantics", () => {
  it("uses integer pesewas and excludes cancelled paid orders from revenue", () => {
    const metrics = summarizeOrderMetrics({
      orders: [
        { id: "completed", status: "COMPLETED", total_minor: 5501 },
        { id: "cancelled", status: "CANCELLED", total_minor: 8000 },
      ],
      payments: [
        { order_id: "completed", method: "CASH", status: "PAID", amount_minor: 5501 },
        { order_id: "cancelled", method: "CARD", status: "PAID", amount_minor: 8000 },
      ],
    });
    assert.equal(metrics.grossOrderValueMinor, 5501);
    assert.equal(metrics.paidRevenueMinor, 5501);
    assert.equal(metrics.paidOrderCount, 1);
    assert.equal(metrics.averageOrderValueMinor, 5501);
  });

  it("renders honest zero metrics", () => {
    const metrics = summarizeOrderMetrics();
    assert.equal(metrics.grossOrderValueMinor, 0);
    assert.equal(metrics.averageOrderValueMinor, 0);
  });
});
