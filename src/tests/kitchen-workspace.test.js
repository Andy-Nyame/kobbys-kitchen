import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  sortActiveKitchenOrders,
  sortReadyKitchenOrders,
} from "../lib/kitchen/queue.js";
import {
  createKitchenWakeLockController,
} from "../lib/kitchen/wake-lock.js";

class FakeVisibilityTarget {
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
    for (const listener of this.listeners.get(type) || []) listener();
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

function createSentinel() {
  const listeners = new Map();
  return {
    released: false,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    async release() {
      this.released = true;
      listeners.get("release")?.();
    },
  };
}

describe("kitchen queue arrangement", () => {
  it("keeps confirmed and preparing work FIFO with newest accepted work at the bottom", () => {
    const queue = sortActiveKitchenOrders([
      { reference: "KK-3", status: "CONFIRMED", acceptedAt: "2026-08-31T18:20:00Z" },
      { reference: "KK-2", status: "PREPARING", acceptedAt: "2026-08-31T18:00:00Z" },
      { reference: "KK-1", status: "CONFIRMED", acceptedAt: "2026-08-31T18:00:00Z" },
      { reference: "KK-4", status: "PENDING", acceptedAt: "2026-08-31T17:00:00Z" },
    ]);

    assert.deepEqual(queue.map((order) => order.reference), ["KK-1", "KK-2", "KK-3"]);
    assert.deepEqual(queue.map((order) => order.status), ["CONFIRMED", "PREPARING", "CONFIRMED"]);
  });

  it("moves ready work into an oldest-ready queue and excludes completed work", () => {
    const orders = [
      { reference: "KK-2", status: "READY_FOR_PICKUP", readyAt: "2026-08-31T19:10:00Z" },
      { reference: "KK-1", status: "READY_FOR_PICKUP", readyAt: "2026-08-31T19:00:00Z" },
      { reference: "KK-3", status: "COMPLETED", readyAt: "2026-08-31T18:00:00Z" },
    ];

    assert.deepEqual(sortActiveKitchenOrders(orders), []);
    assert.deepEqual(sortReadyKitchenOrders(orders).map((order) => order.reference), ["KK-1", "KK-2"]);
  });

  it("places pickup verification before active work and ready work below it", async () => {
    const page = await readFile("src/app/kitchen/page.js", "utf8");
    const pickupPosition = page.indexOf("<PickupVerification />");
    const activePosition = page.indexOf("New / Preparing Orders");
    const readyPosition = page.indexOf("Ready for Pickup");

    assert.ok(pickupPosition > -1 && pickupPosition < activePosition);
    assert.ok(activePosition < readyPosition);
    assert.match(page, /No orders being prepared\./);
    assert.match(page, /No orders ready for pickup\./);
    assert.doesNotMatch(page, /Completed Orders/);
  });
});

describe("kitchen screen wake lock", () => {
  it("automatically requests the screen lock when the Kitchen workspace is visible", async () => {
    const visibilityTarget = new FakeVisibilityTarget();
    const requests = [];
    const controller = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: { request: async (type) => { requests.push(type); return createSentinel(); } },
    });

    const stop = controller.start();
    await Promise.resolve();
    assert.deepEqual(requests, ["screen"]);
    stop();
  });

  it("releases while hidden, reacquires when visible, and cleans up on unmount", async () => {
    const visibilityTarget = new FakeVisibilityTarget();
    const sentinels = [];
    const controller = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: { request: async () => { const lock = createSentinel(); sentinels.push(lock); return lock; } },
    });

    const stop = controller.start();
    await Promise.resolve();
    assert.equal(sentinels.length, 1);
    assert.equal(visibilityTarget.listenerCount("visibilitychange"), 1);

    visibilityTarget.hidden = true;
    visibilityTarget.dispatch("visibilitychange");
    await Promise.resolve();
    assert.equal(sentinels[0].released, true);

    visibilityTarget.hidden = false;
    visibilityTarget.dispatch("visibilitychange");
    await Promise.resolve();
    assert.equal(sentinels.length, 2);

    stop();
    await Promise.resolve();
    assert.equal(sentinels[1].released, true);
    assert.equal(visibilityTarget.listenerCount("visibilitychange"), 0);
  });

  it("fails safely when wake lock is unsupported or rejected", async () => {
    const visibilityTarget = new FakeVisibilityTarget();
    const unsupportedFailures = [];
    const unsupported = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: undefined,
      onFailure: (category) => unsupportedFailures.push(category),
    });
    unsupported.start();
    assert.equal(await unsupported.request(), false);
    assert.deepEqual(unsupportedFailures, ["unsupported"]);
    unsupported.stop();

    const rejectedFailures = [];
    const rejected = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: { request: async () => { throw new Error("not allowed"); } },
      onFailure: (category) => rejectedFailures.push(category),
    });
    rejected.start();
    assert.equal(await rejected.request(), false);
    assert.deepEqual(rejectedFailures, ["request_failed"]);
    rejected.stop();
  });

  it("has no visible control or local preference and mounts only after Kitchen authentication", async () => {
    const [wakeLock, pickup, page, styles, marketingLayout, adminLayout] = await Promise.all([
      readFile("src/components/kitchen/KitchenWakeLock.jsx", "utf8"),
      readFile("src/components/pickup/PickupVerification.jsx", "utf8"),
      readFile("src/app/kitchen/page.js", "utf8"),
      readFile("src/app/globals.css", "utf8"),
      readFile("src/app/(marketing)/layout.js", "utf8"),
      readFile("src/app/admin/layout.js", "utf8"),
    ]);

    assert.match(wakeLock, /return controller\.start\(\)/);
    assert.match(wakeLock, /return null/);
    assert.doesNotMatch(wakeLock, /localStorage|checkbox|role="switch"|Keep screen awake/);
    assert.doesNotMatch(page, /KitchenWakeLockControl|Keep screen awake|checkbox/);
    assert.doesNotMatch(styles, /kitchen-wake-lock/);
    assert.ok(page.indexOf("<KitchenWakeLock />") > page.indexOf("if (!user)"));
    assert.doesNotMatch(marketingLayout, /KitchenWakeLock/);
    assert.doesNotMatch(adminLayout, /KitchenWakeLock/);
    assert.match(pickup, /const \[code, setCode\] = useState\(""\)/);
    assert.match(page, /OperationalAutoRefresh exactPaths=\{\["\/kitchen"\]\}/);
  });
});
