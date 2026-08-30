import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { formatMoneyMinor } from "../lib/admin/presentation.js";
import { summarizeOrderMetrics } from "../lib/analytics/order-metrics.js";

describe("compact analytics dashboard presentation", () => {
  it("uses one shared semantic metric card with compact no-wrap values", async () => {
    const [card, orderAnalytics, accountAnalytics, css] = await Promise.all([
      readFile("src/components/admin/AdminMetricCard.jsx", "utf8"),
      readFile("src/components/admin/AdminOrderAnalytics.jsx", "utf8"),
      readFile("src/app/admin/analytics/page.js", "utf8"),
      readFile("src/app/globals.css", "utf8"),
    ]);

    assert.match(card, /<h3 className="admin-metric__label">/);
    assert.match(orderAnalytics, /AdminMetricCard/);
    assert.match(accountAnalytics, /AdminMetricCard/);
    assert.match(css, /\.admin-metric__value\s*\{[\s\S]*font-size: clamp\(/);
    assert.match(css, /\.admin-metric__value\s*\{[\s\S]*white-space: nowrap/);
    assert.match(css, /font-variant-numeric: tabular-nums/);
    const valueBlock = css.match(/\.admin-metric__value\s*\{([^}]*)\}/)?.[1] || "";
    assert.doesNotMatch(valueBlock, /overflow-wrap: anywhere/);
  });

  it("keeps zero, ordinary, and representative large currency values authoritative", () => {
    assert.equal(formatMoneyMinor(0), "GH₵0.00");
    assert.equal(formatMoneyMinor(22_500), "GH₵225.00");
    assert.equal(formatMoneyMinor(999_900), "GH₵9,999.00");
    assert.equal(formatMoneyMinor(12_500_000), "GH₵125,000.00");
  });

  it("uses a responsive one, two, three, and four-column KPI strategy", async () => {
    const css = await readFile("src/app/globals.css", "utf8");

    assert.match(css, /\.analytics-kpi-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(css, /@media \(min-width: 640px\)[\s\S]*\.analytics-kpi-grid[\s\S]*repeat\(2/);
    assert.match(css, /@media \(min-width: 900px\)[\s\S]*\.analytics-kpi-grid[\s\S]*repeat\(3/);
    assert.match(css, /@media \(min-width: 1200px\)[\s\S]*\.analytics-kpi-grid[\s\S]*repeat\(4/);
    assert.match(css, /\.analytics-kpi-grid \.admin-metric\s*\{[\s\S]*height: 100%/);
  });

  it("builds charts only from trusted revenue, order, and registration series", async () => {
    const [chart, orderAnalytics, accountAnalytics] = await Promise.all([
      readFile("src/components/admin/AnalyticsBarChart.jsx", "utf8"),
      readFile("src/components/admin/AdminOrderAnalytics.jsx", "utf8"),
      readFile("src/app/admin/analytics/page.js", "utf8"),
    ]);

    assert.match(chart, /<figcaption className="sr-only">\{ariaLabel\}<\/figcaption>/);
    assert.match(chart, /<ul className="sr-only">/);
    assert.match(orderAnalytics, /metrics\.revenueByDay/);
    assert.match(orderAnalytics, /metrics\.orderCountByDay/);
    assert.match(accountAnalytics, /metrics\.registrationTrend/);
    assert.doesNotMatch(`${orderAnalytics}\n${accountAnalytics}`, /[+-]\d+(?:\.\d+)?%/);
  });

  it("preserves every existing revenue KPI and clarifies averages and payment groups", async () => {
    const component = await readFile(
      "src/components/admin/AdminOrderAnalytics.jsx",
      "utf8"
    );

    for (const field of [
      "paidRevenueMinor",
      "grossOrderValueMinor",
      "paidOrderCount",
      "averageOrderValueMinor",
      "averagePaidOrderValueMinor",
      "unpaidCashValueMinor",
      "revenueByPaymentMethodMinor",
      "orderStatusCounts",
      "topItems",
    ]) {
      assert.match(component, new RegExp(`metrics\\.${field}`));
    }
    assert.match(component, /All non-cancelled orders/);
    assert.match(component, /Paid orders only/);
    assert.match(component, /Payment Breakdown/);
    assert.match(component, /Not recognized revenue/);
  });

  it("keeps account analytics truthful and separate from revenue", async () => {
    const page = await readFile("src/app/admin/analytics/page.js", "utf8");

    for (const field of [
      "totalAccounts",
      "customerCount",
      "adminCount",
      "registrationsToday",
      "registrationsSevenDays",
      "registrationsThirtyDays",
      "googleAccountCount",
      "credentialAccountCount",
      "recentAccounts",
    ]) {
      assert.match(page, new RegExp(`metrics\\.${field}`));
    }
    assert.doesNotMatch(page, /paidRevenueMinor|grossOrderValueMinor|Active Users/);
    assert.match(page, /Authentication Breakdown/);
  });

  it("does not change recognized-revenue semantics", () => {
    const metrics = summarizeOrderMetrics({
      orders: [
        { id: "paid", status: "COMPLETED", total_minor: 22_500 },
        { id: "cancelled", status: "CANCELLED", total_minor: 9_000 },
        { id: "unpaid", status: "PENDING", total_minor: 7_500 },
      ],
      payments: [
        { order_id: "paid", method: "CASH", status: "PAID", amount_minor: 22_500 },
        { order_id: "cancelled", method: "CARD", status: "PAID", amount_minor: 9_000 },
        { order_id: "unpaid", method: "CASH", status: "UNPAID", amount_minor: 7_500 },
      ],
    });

    assert.equal(metrics.paidRevenueMinor, 22_500);
    assert.equal(metrics.unpaidCashValueMinor, 7_500);
    assert.equal(metrics.revenueByPaymentMethodMinor.CARD, 0);
  });

  it("keeps analytics explicit-refresh only and preserves clean empty states", async () => {
    const [ordersPage, orderAnalytics, accountAnalytics] = await Promise.all([
      readFile("src/app/admin/orders/page.js", "utf8"),
      readFile("src/components/admin/AdminOrderAnalytics.jsx", "utf8"),
      readFile("src/app/admin/analytics/page.js", "utf8"),
    ]);

    assert.match(ordersPage, /view === "analytics" \? null/);
    assert.doesNotMatch(`${orderAnalytics}\n${accountAnalytics}`, /OperationalAutoRefresh/);
    assert.match(orderAnalytics, /No recognized revenue exists for this range/);
    assert.match(orderAnalytics, /Top items will appear after paid orders are completed/);
    assert.match(accountAnalytics, /No registered accounts are available yet/);
  });
});
