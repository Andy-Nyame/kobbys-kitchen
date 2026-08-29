import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { resolveEffectiveOrderingState } from "../lib/ordering/state.js";
import { presentPublicOrderingState, presentWeeklySchedule } from "../lib/ordering/presentation.js";

describe("online ordering-hours presentation", () => {
  it("keeps all seven configurable online-ordering days", () => {
    const schedule = presentWeeklySchedule([{ dayOfWeek: 1, startMinute: 600, endMinute: 1200 }]);
    assert.equal(schedule.length, 7);
    assert.equal(schedule[0].windows[0].label, "10:00 AM – 8:00 PM");
    assert.equal(schedule[1].label, "Tuesday");
    assert.deepEqual(schedule[1].windows, []);
  });

  it("supports multiple windows without consulting live overrides", () => {
    const schedule = presentWeeklySchedule([
      { dayOfWeek: 5, startMinute: 600, endMinute: 840 },
      { dayOfWeek: 5, startMinute: 1020, endMinute: 1260 },
    ]);
    assert.equal(schedule[4].windows.length, 2);
  });

  it("sources public pages from the separate physical business-hours server", async () => {
    const [about, businessData] = await Promise.all([
      readFile(new URL("../app/(marketing)/about/page.js", import.meta.url), "utf8"),
      readFile(new URL("../data/businessData.js", import.meta.url), "utf8"),
    ]);
    assert.match(about, /getPublicBusinessHours/);
    assert.match(about, /lib\/business-hours\/server/);
    assert.doesNotMatch(about, /lib\/ordering\/server/);
    assert.doesNotMatch(businessData, /openingHours/);
  });
});

describe("safe public ordering status", () => {
  const schedule = [{ dayOfWeek: 1, startMinute: 600, endMinute: 1200 }];
  function state(overrides = {}) {
    return resolveEffectiveOrderingState({ featureEnabled: true, setting: { emergencyPaused: false, overrideMode: "NONE" }, scheduleWindows: schedule, now: new Date("2026-08-31T12:00:00Z"), ...overrides });
  }

  it("presents OPEN and next close without raw codes or repeated timezone labels", () => {
    const publicState = presentPublicOrderingState(state());
    assert.equal(publicState.label, "OPEN");
    assert.equal(publicState.headline, "Online Ordering Open");
    assert.equal(publicState.message, "Place your order online and pick it up when it’s ready.");
    assert.match(publicState.detail, /8:00 PM/);
    assert.doesNotMatch(publicState.detail, /GMT/);
    assert.equal("reason" in publicState, false);
  });

  it("sanitizes scheduled, emergency, forced and expired override states", () => {
    assert.equal(presentPublicOrderingState(state({ now: new Date("2026-09-01T12:00:00Z") })).label, "CLOSED");
    assert.match(presentPublicOrderingState(state({ setting: { emergencyPaused: true, overrideMode: "NONE" } })).message, /temporarily unavailable/);
    assert.match(presentPublicOrderingState(state({ setting: { emergencyPaused: false, overrideMode: "CLOSED" } })).message, /temporarily closed/);
    assert.equal(presentPublicOrderingState(state({ setting: { emergencyPaused: false, overrideMode: "OPEN" }, scheduleWindows: [] })).label, "OPEN");
    assert.equal(presentPublicOrderingState(state({ setting: { emergencyPaused: false, overrideMode: "CLOSED", overrideExpiresAt: new Date("2026-08-31T11:00:00Z") } })).label, "OPEN");
  });

  it("keeps menu, cart and order status integration explicit", async () => {
    for (const path of ["../app/(marketing)/menu/page.js", "../app/(marketing)/cart/page.js", "../app/(marketing)/order/page.js", "../app/(customer)/checkout/page.js"]) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      assert.match(source, /OrderingStatusNotice/);
      assert.match(source, /getPublicOrderingStatus/);
    }
    const cart = await readFile(new URL("../app/(marketing)/cart/page.js", import.meta.url), "utf8");
    assert.match(cart, /cart is saved/i);
  });

  it("keeps matching native time controls for every online-ordering window", async () => {
    const manager = await readFile(
      new URL("../components/admin/AdminOperationsManager.jsx", import.meta.url),
      "utf8"
    );
    assert.equal((manager.match(/type="time"/g) || []).length, 2);
    assert.match(manager, /"startTime"/);
    assert.match(manager, /"endTime"/);
  });
});
