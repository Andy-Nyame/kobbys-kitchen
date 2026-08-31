import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  sortActiveKitchenOrders,
  sortReadyKitchenOrders,
} from "../lib/kitchen/queue.js";
import {
  KITCHEN_WAKE_LOCK_STORAGE_KEY,
  createKitchenWakeLockController,
  readKitchenWakeLockPreference,
  writeKitchenWakeLockPreference,
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

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
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
  it("defaults off and persists an explicit device-local preference", () => {
    const storage = createMemoryStorage();
    assert.equal(readKitchenWakeLockPreference(storage), false);
    assert.equal(writeKitchenWakeLockPreference(storage, true), true);
    assert.equal(storage.getItem(KITCHEN_WAKE_LOCK_STORAGE_KEY), "true");
    assert.equal(readKitchenWakeLockPreference(storage), true);
    writeKitchenWakeLockPreference(storage, false);
    assert.equal(readKitchenWakeLockPreference(storage), false);
  });

  it("requests the screen lock only when enabled and visible", async () => {
    const visibilityTarget = new FakeVisibilityTarget();
    const requests = [];
    const controller = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: { request: async (type) => { requests.push(type); return createSentinel(); } },
    });

    const stop = controller.start(false);
    await Promise.resolve();
    assert.deepEqual(requests, []);
    controller.setEnabled(true);
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

    const stop = controller.start(true);
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
    const unsupportedStatuses = [];
    const unsupported = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: undefined,
      onStatus: (status) => unsupportedStatuses.push(status),
    });
    unsupported.start(true);
    assert.equal(await unsupported.request(), false);
    assert.ok(unsupportedStatuses.includes("unsupported"));
    unsupported.stop();

    const rejectedStatuses = [];
    const rejected = createKitchenWakeLockController({
      visibilityTarget,
      wakeLock: { request: async () => { throw new Error("not allowed"); } },
      onStatus: (status) => rejectedStatuses.push(status),
    });
    rejected.start(true);
    assert.equal(await rejected.request(), false);
    assert.ok(rejectedStatuses.includes("unavailable"));
    rejected.stop();
  });

  it("keeps pickup input state client-local and exposes an accessible switch", async () => {
    const [control, pickup, page] = await Promise.all([
      readFile("src/components/kitchen/KitchenWakeLockControl.jsx", "utf8"),
      readFile("src/components/pickup/PickupVerification.jsx", "utf8"),
      readFile("src/app/kitchen/page.js", "utf8"),
    ]);

    assert.match(control, /window\.localStorage/);
    assert.match(control, /role="switch"/);
    assert.match(control, /Keep screen awake/);
    assert.match(pickup, /const \[code, setCode\] = useState\(""\)/);
    assert.match(page, /OperationalAutoRefresh exactPaths=\{\["\/kitchen"\]\}/);
  });
});
