import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  OPERATIONAL_REFRESH_INTERVAL_MS,
  createOperationalRefreshController,
  pathMatchesOperationalSurface,
} from "../lib/operations/auto-refresh.js";

class FakeEventTarget {
  constructor() {
    this.hidden = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener();
    }
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

function createFakeScheduler() {
  let nextId = 1;
  const intervals = new Map();

  return {
    setInterval(callback, delay) {
      const id = nextId;
      nextId += 1;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    tick() {
      for (const { callback } of [...intervals.values()]) {
        callback();
      }
    },
    count() {
      return intervals.size;
    },
    delays() {
      return [...intervals.values()].map(({ delay }) => delay);
    },
  };
}

function createHarness(refresh = () => {}) {
  const visibilityTarget = new FakeEventTarget();
  const focusTarget = new FakeEventTarget();
  const scheduler = createFakeScheduler();
  let currentTime = 10_000;
  const controller = createOperationalRefreshController({
    refresh,
    visibilityTarget,
    focusTarget,
    scheduler,
    now: () => currentTime,
  });

  return {
    controller,
    focusTarget,
    scheduler,
    visibilityTarget,
    advance(milliseconds) {
      currentTime += milliseconds;
    },
  };
}

describe("operational auto-refresh controller", () => {
  it("starts one ten-second timer while visible and never duplicates it", () => {
    let refreshCount = 0;
    const harness = createHarness(() => {
      refreshCount += 1;
    });

    const cleanup = harness.controller.start();
    harness.controller.start();

    assert.equal(OPERATIONAL_REFRESH_INTERVAL_MS, 10_000);
    assert.equal(harness.scheduler.count(), 1);
    assert.deepEqual(harness.scheduler.delays(), [10_000]);

    harness.scheduler.tick();
    assert.equal(refreshCount, 1);
    cleanup();
  });

  it("pauses while hidden, refreshes immediately on return, and coalesces focus", () => {
    let refreshCount = 0;
    const harness = createHarness(() => {
      refreshCount += 1;
    });

    harness.controller.start();
    harness.visibilityTarget.hidden = true;
    harness.visibilityTarget.dispatch("visibilitychange");
    assert.equal(harness.scheduler.count(), 0);

    harness.advance(10_000);
    harness.visibilityTarget.hidden = false;
    harness.visibilityTarget.dispatch("visibilitychange");
    assert.equal(refreshCount, 1);
    assert.equal(harness.scheduler.count(), 1);

    harness.focusTarget.dispatch("focus");
    assert.equal(refreshCount, 1);
    harness.advance(1_000);
    harness.focusTarget.dispatch("focus");
    assert.equal(refreshCount, 2);
    harness.controller.stop();
  });

  it("cleans timers and listeners on unmount", () => {
    const harness = createHarness();
    const cleanup = harness.controller.start();

    assert.equal(harness.visibilityTarget.listenerCount("visibilitychange"), 1);
    assert.equal(harness.focusTarget.listenerCount("focus"), 1);
    cleanup();

    assert.equal(harness.scheduler.count(), 0);
    assert.equal(harness.visibilityTarget.listenerCount("visibilitychange"), 0);
    assert.equal(harness.focusTarget.listenerCount("focus"), 0);
  });

  it("keeps retrying after a failed quiet background refresh", async () => {
    let attempts = 0;
    const harness = createHarness(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary network failure");
      }
    });

    harness.controller.start();
    harness.scheduler.tick();
    await new Promise((resolve) => setImmediate(resolve));
    harness.advance(10_000);
    harness.scheduler.tick();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(attempts, 2);
    harness.controller.stop();
  });
});

describe("operational refresh integration", () => {
  it("polls live routes but excludes static and configuration surfaces", () => {
    const marketing = {
      exactPaths: ["/menu", "/cart", "/order"],
    };
    assert.equal(pathMatchesOperationalSurface("/menu", marketing), true);
    assert.equal(pathMatchesOperationalSurface("/about", marketing), false);
    assert.equal(pathMatchesOperationalSurface("/gallery", marketing), false);
    assert.equal(pathMatchesOperationalSurface("/admin/settings", marketing), false);
    assert.equal(pathMatchesOperationalSurface("/admin/operations", marketing), false);
  });

  it("uses one trusted, narrow endpoint for customer and public operational state", async () => {
    const [route, provider, marketingLayout, customerLayout] = await Promise.all([
      readFile("src/app/api/operational-status/route.js", "utf8"),
      readFile("src/components/operations/OperationalStatusProvider.jsx", "utf8"),
      readFile("src/app/(marketing)/layout.js", "utf8"),
      readFile("src/app/(customer)/layout.js", "utf8"),
    ]);

    assert.match(route, /getCustomerAccess\(\)/);
    assert.match(route, /getCustomerActiveOrderOverview\(user\.id\)/);
    assert.match(route, /getPublicOrderingStatus\(\)/);
    assert.doesNotMatch(route, /searchParams|request\.json|userId\s*=/);
    assert.match(provider, /useOperationalAutoRefresh\(\{ enabled, refresh \}\)/);
    assert.match(provider, /cache: "no-store"/);
    assert.match(marketingLayout, /role === "CUSTOMER"/);
    assert.match(marketingLayout, /"\/menu", "\/cart", "\/order"/);
    assert.doesNotMatch(marketingLayout, /"\/about"|"\/gallery"/);
    assert.match(customerLayout, /"\/account\/orders"/);
    assert.match(customerLayout, /"\/checkout"/);
  });

  it("refreshes customer Home, navigation count, order pages, and public ordering notices", async () => {
    const [home, navigation, notice, cart, checkout, orderBadge] = await Promise.all([
      readFile("src/components/orders/CustomerHomeOrders.jsx", "utf8"),
      readFile("src/components/navigation/CustomerOrdersNavigationLink.jsx", "utf8"),
      readFile("src/components/ordering/OrderingStatusNotice.jsx", "utf8"),
      readFile("src/components/cart/CartPageContent.jsx", "utf8"),
      readFile("src/components/checkout/CheckoutForm.jsx", "utf8"),
      readFile("src/components/ordering/OrderingAvailabilityBadge.jsx", "utf8"),
    ]);

    assert.match(home, /useLiveCustomerOrderOverview/);
    assert.match(navigation, /useLiveCustomerOrderOverview/);
    assert.match(notice, /useLiveOrderingStatus/);
    assert.match(cart, /useLiveOrderingStatus/);
    assert.match(checkout, /useLiveOrderingStatus/);
    assert.match(orderBadge, /useLiveOrderingStatus/);
  });

  it("mounts quiet refresh only on operational admin and kitchen views", async () => {
    const [admin, adminOrders, kitchen, refreshComponent] = await Promise.all([
      readFile("src/app/admin/page.js", "utf8"),
      readFile("src/app/admin/orders/page.js", "utf8"),
      readFile("src/app/kitchen/page.js", "utf8"),
      readFile("src/components/operations/OperationalAutoRefresh.jsx", "utf8"),
    ]);

    assert.match(admin, /exactPaths=\{\["\/admin"\]\}/);
    assert.match(adminOrders, /view === "analytics" \? null/);
    assert.match(adminOrders, /exactPaths=\{\["\/admin\/orders"\]\}/);
    assert.match(kitchen, /exactPaths=\{\["\/kitchen"\]\}/);
    assert.match(kitchen, /queue\.ready\.length} orders ready for pickup/);
    assert.match(refreshComponent, /router\.refresh\(\)/);
    assert.doesNotMatch(refreshComponent, /window\.location|KitchenLoader|LoadingSpinner/);
  });

  it("preserves local pickup and kitchen input state while mutations refresh immediately", async () => {
    const [pickupCard, pickupVerification, readyButton, adminActions, kitchenOrders] = await Promise.all([
      readFile("src/components/orders/PickupCodeCard.jsx", "utf8"),
      readFile("src/components/pickup/PickupVerification.jsx", "utf8"),
      readFile("src/components/kitchen/KitchenReadyButton.jsx", "utf8"),
      readFile("src/components/admin/AdminOrderActions.jsx", "utf8"),
      readFile("src/lib/kitchen/orders.js", "utf8"),
    ]);

    assert.match(pickupCard, /useState\(false\)/);
    assert.match(pickupVerification, /useState\(""\)/);
    assert.match(pickupVerification, /router\.refresh\(\)/);
    assert.match(readyButton, /router\.refresh\(\)/);
    assert.match(adminActions, /router\.refresh\(\)/);
    assert.match(kitchenOrders, /orderBy: \{ createdAt: "asc" \}/);
  });
});
