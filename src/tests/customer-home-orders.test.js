import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CUSTOMER_ACTIVE_ORDER_STATUSES,
  isCustomerActiveOrderStatus,
  queryCustomerActiveOrderOverview,
} from "../lib/orders/customer-active.js";
import { formatOrderLabel } from "../lib/orders/presentation.js";

function createOrderDatabase() {
  const calls = [];
  const ready = [
    {
      reference: "KK-READY",
      status: "READY_FOR_PICKUP",
      totalMinor: 8000,
      currency: "GHS",
      placedAt: new Date("2026-08-30T12:00:00Z"),
    },
  ];
  const other = [
    {
      reference: "KK-PREPARING",
      status: "PREPARING",
      totalMinor: 6000,
      currency: "GHS",
      placedAt: new Date("2026-08-30T13:00:00Z"),
    },
    {
      reference: "KK-PENDING",
      status: "PENDING",
      totalMinor: 4000,
      currency: "GHS",
      placedAt: new Date("2026-08-30T11:00:00Z"),
    },
    {
      reference: "KK-EXTRA",
      status: "CONFIRMED",
      totalMinor: 3000,
      currency: "GHS",
      placedAt: new Date("2026-08-30T10:00:00Z"),
    },
  ];

  return {
    calls,
    order: {
      count: async (query) => {
        calls.push({ method: "count", query });
        return 4;
      },
      findMany: async (query) => {
        calls.push({ method: "findMany", query });
        return query.where.status === "READY_FOR_PICKUP" ? ready : other;
      },
    },
  };
}

describe("trusted customer active-order overview", () => {
  it("uses one active-status definition and excludes past or unpaid pre-orders", () => {
    assert.deepEqual(CUSTOMER_ACTIVE_ORDER_STATUSES, [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY_FOR_PICKUP",
    ]);
    for (const status of CUSTOMER_ACTIVE_ORDER_STATUSES) {
      assert.equal(isCustomerActiveOrderStatus(status), true);
    }
    for (const status of ["AWAITING_PAYMENT", "COMPLETED", "CANCELLED"]) {
      assert.equal(isCustomerActiveOrderStatus(status), false);
    }
  });

  it("scopes every query to the trusted user, prioritizes ready orders, and caps Home at three", async () => {
    const database = createOrderDatabase();
    const overview = await queryCustomerActiveOrderOverview(
      database,
      "customer-a",
      { limit: 99 }
    );

    assert.equal(overview.totalCount, 4);
    assert.deepEqual(
      overview.orders.map((order) => order.reference),
      ["KK-READY", "KK-PREPARING", "KK-PENDING"]
    );
    assert.equal(
      database.calls.every((call) => call.query.where.userId === "customer-a"),
      true
    );
    assert.equal(
      database.calls
        .filter((call) => call.method === "findMany")
        .every((call) => call.query.take === 3),
      true
    );
  });

  it("uses a count-only query for the navigation badge", async () => {
    const database = createOrderDatabase();
    const overview = await queryCustomerActiveOrderOverview(
      database,
      "customer-a",
      { limit: 0 }
    );

    assert.deepEqual(overview, { totalCount: 4, orders: [] });
    assert.equal(
      database.calls.filter((call) => call.method === "findMany").length,
      0
    );
  });

  it("reuses the existing customer-facing order labels", () => {
    assert.equal(formatOrderLabel("PENDING"), "Order Placed / Awaiting Confirmation");
    assert.equal(formatOrderLabel("CONFIRMED"), "Order Accepted");
    assert.equal(formatOrderLabel("PREPARING"), "Food is being prepared");
    assert.equal(formatOrderLabel("READY_FOR_PICKUP"), "Ready for Pickup");
  });
});

describe("customer Home and public Orders navigation", () => {
  it("preserves the signed-out hero and renders customer content only for a trusted CUSTOMER", async () => {
    const home = await readFile("src/app/(marketing)/page.js", "utf8");

    assert.match(home, /role === "CUSTOMER"/);
    assert.match(home, /<CustomerHomeOrders overview=\{customerOrderOverview\} \/>/);
    assert.match(home, /Welcome to Kobby&apos;s Kitchen/);
    assert.doesNotMatch(home, /searchParams|query\.userId|userId=/);
  });

  it("renders concise no-order, active, ready, and multiple-order actions without exposing a pickup code", async () => {
    const component = await readFile(
      "src/components/orders/CustomerHomeOrders.jsx",
      "utf8"
    );

    assert.match(component, /Ready to order\?/);
    assert.match(component, /href="\/menu"[\s\S]*Order Online/);
    assert.match(component, /href="\/account\/orders"[\s\S]*My Orders/);
    assert.match(component, /Track Order/);
    assert.match(component, /View Pickup Code/);
    assert.match(component, /View All Orders/);
    assert.match(component, /\.slice|overview\?\.orders/);
    assert.doesNotMatch(component, /order\.pickupCode/);
    assert.doesNotMatch(component, /customerEmail|customerPhone|customerName/);
  });

  it("shows Orders and its active count only when the server resolved CUSTOMER navigation", async () => {
    const [header, desktop, mobile, orderLink] = await Promise.all([
      readFile("src/components/layout/SiteHeader.jsx", "utf8"),
      readFile("src/components/navigation/DesktopNavigation.jsx", "utf8"),
      readFile("src/components/navigation/MobileNavigation.jsx", "utf8"),
      readFile(
        "src/components/navigation/CustomerOrdersNavigationLink.jsx",
        "utf8"
      ),
    ]);

    assert.match(header, /role === "CUSTOMER"/);
    assert.match(header, /customerOrdersNavigation = \{ activeOrderCount: 0 \}/);
    assert.match(header, /getCustomerActiveOrderOverview\(user\.id/);
    assert.match(header, /role === "ADMIN" \|\| role === "CHEF"/);
    assert.match(desktop, /customerOrdersNavigation \?/);
    assert.match(mobile, /customerOrdersNavigation \?/);
    assert.match(mobile, /excludedMobileAccountHrefs/);
    assert.match(orderLink, /href="\/account\/orders"/);
    assert.match(orderLink, /orders-navigation-badge/);
    assert.match(orderLink, /active order/);
  });

  it("keeps owned order details and routes every server-confirmed checkout result safely", async () => {
    const [queries, checkout, route] = await Promise.all([
      readFile("src/lib/orders/customer-orders.js", "utf8"),
      readFile("src/components/checkout/CheckoutForm.jsx", "utf8"),
      readFile("src/app/api/orders/route.js", "utf8"),
    ]);

    assert.match(queries, /where: \{ userId, reference \}/);
    assert.match(checkout, /clearCart\(\);\s*\n\s*router\.push\(result\.redirectTo\)/);
    assert.match(
      route,
      /order\.paymentStatus === "PAID" \? "payment=success" : order\.paymentInitializationFailed \? "payment=failed" : order\.paymentInitializationPending \? "payment=pending" : "placed=1"/
    );
  });
});
