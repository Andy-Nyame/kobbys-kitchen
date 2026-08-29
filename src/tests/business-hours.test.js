import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BUSINESS_TIME_ZONE,
  resolveBusinessHoursState,
  validateBusinessHours,
} from "../lib/business-hours/state.js";
import {
  presentBusinessHours,
} from "../lib/business-hours/presentation.js";
import {
  OrderingClosedForSubmissionError,
  assertOrderingStateOpenForSubmission,
  combineBusinessAndOnlineOrderingState,
  resolveEffectiveOrderingState,
} from "../lib/ordering/state.js";
import { presentPublicOrderingState } from "../lib/ordering/presentation.js";

const physicalSchedule = [1, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 16 * 60,
  endMinute: 0,
  endsNextDay: true,
  sortOrder: 0,
}));

function physical(now) {
  return resolveBusinessHoursState({ windows: physicalSchedule, now: new Date(now) });
}

function online(acceptingOrders = true, overrides = {}) {
  return {
    acceptingOrders,
    reason: acceptingOrders ? "SCHEDULE_OPEN" : "SCHEDULE_CLOSED",
    source: "SCHEDULE",
    currentTime: "2026-08-31T18:00:00.000Z",
    nextOpenAt: null,
    nextCloseAt: "2026-08-31T22:00:00.000Z",
    emergencyPaused: false,
    overrideActive: false,
    ...overrides,
  };
}

describe("physical business-hours domain", () => {
  it("uses Africa/Accra and renders the configured physical week independently", () => {
    assert.equal(BUSINESS_TIME_ZONE, "Africa/Accra");
    const presented = presentBusinessHours(physicalSchedule);
    assert.equal(presented.length, 7);
    assert.equal(presented[0].windows[0].label, "4:00 PM – 12:00 AM");
    assert.deepEqual(presented[1].windows, []);
    assert.equal(presented[2].windows[0].label, "4:00 PM – 12:00 AM");
  });

  it("uses exact overnight [start, end) boundaries around the Tuesday off day", () => {
    assert.equal(physical("2026-08-31T15:59:59.000Z").restaurantOpen, false);
    assert.equal(physical("2026-08-31T16:00:00.000Z").restaurantOpen, true);
    assert.equal(physical("2026-08-31T23:59:59.000Z").restaurantOpen, true);
    assert.equal(physical("2026-09-01T00:00:00.000Z").restaurantOpen, false);
    assert.equal(physical("2026-09-01T16:00:00.000Z").restaurantOpen, false);
    assert.equal(physical("2026-09-02T15:59:59.000Z").restaurantOpen, false);
    assert.equal(physical("2026-09-02T16:00:00.000Z").restaurantOpen, true);
  });

  it("finds Wednesday as the next opening throughout Tuesday", () => {
    const state = physical("2026-09-01T12:00:00.000Z");
    assert.equal(state.currentBusinessDayLabel, "Tuesday");
    assert.equal(state.todayClosed, true);
    assert.equal(state.nextOpenAt, "2026-09-02T16:00:00.000Z");
  });

  it("validates explicit overnight ranges and rejects overlap", () => {
    assert.doesNotThrow(() => validateBusinessHours(physicalSchedule));
    assert.throws(
      () => validateBusinessHours([
        { dayOfWeek: 1, startMinute: 960, endMinute: 0, endsNextDay: true },
        { dayOfWeek: 1, startMinute: 1200, endMinute: 1380, endsNextDay: false },
      ]),
      /cannot overlap/
    );
  });
});

describe("physical and online ordering separation", () => {
  it("automatically follows a 5 PM–10 PM online window inside physical hours", () => {
    const scheduleWindows = [
      { dayOfWeek: 1, startMinute: 17 * 60, endMinute: 22 * 60 },
      { dayOfWeek: 2, startMinute: 17 * 60, endMinute: 22 * 60 },
    ];
    const combinedAt = (value) => {
      const now = new Date(value);
      return combineBusinessAndOnlineOrderingState({
        onlineState: resolveEffectiveOrderingState({
          featureEnabled: true,
          setting: { emergencyPaused: false, overrideMode: "NONE" },
          scheduleWindows,
          now,
        }),
        businessState: physical(value),
      });
    };

    assert.equal(combinedAt("2026-08-31T16:30:00.000Z").restaurantOpen, true);
    assert.equal(combinedAt("2026-08-31T16:59:59.000Z").acceptingOrders, false);
    assert.equal(combinedAt("2026-08-31T17:00:00.000Z").acceptingOrders, true);
    assert.equal(combinedAt("2026-08-31T21:59:59.000Z").acceptingOrders, true);
    assert.equal(combinedAt("2026-08-31T22:00:00.000Z").acceptingOrders, false);
    assert.equal(combinedAt("2026-08-31T22:30:00.000Z").restaurantOpen, true);
    assert.equal(combinedAt("2026-08-31T22:30:00.000Z").acceptingOrders, false);
    assert.equal(combinedAt("2026-09-01T00:00:00.000Z").restaurantOpen, false);
    assert.equal(combinedAt("2026-09-01T18:00:00.000Z").acceptingOrders, false);
  });

  it("keeps the deployment flag first in effective-state precedence", () => {
    const onlineState = resolveEffectiveOrderingState({
      featureEnabled: false,
      setting: { emergencyPaused: true, overrideMode: "OPEN" },
      scheduleWindows: [],
      now: new Date("2026-09-01T18:00:00.000Z"),
    });
    const combined = combineBusinessAndOnlineOrderingState({
      onlineState,
      businessState: physical("2026-09-01T18:00:00.000Z"),
    });

    assert.equal(combined.acceptingOrders, false);
    assert.equal(combined.reason, "BUILD_DISABLED");
    assert.equal(combined.source, "BUILD_FLAG");
    assert.equal(combined.restaurantOpen, false);
  });

  it("allows checkout only when both physical and online states are open", () => {
    const combined = combineBusinessAndOnlineOrderingState({
      onlineState: online(true),
      businessState: physical("2026-08-31T18:00:00.000Z"),
    });
    assert.equal(combined.acceptingOrders, true);
    assert.doesNotThrow(() => assertOrderingStateOpenForSubmission(combined));
  });

  it("rejects online CLOSED while preserving physical OPEN", () => {
    const combined = combineBusinessAndOnlineOrderingState({
      onlineState: online(false),
      businessState: physical("2026-08-31T18:00:00.000Z"),
    });
    assert.equal(combined.restaurantOpen, true);
    assert.equal(combined.acceptingOrders, false);
    assert.throws(
      () => assertOrderingStateOpenForSubmission(combined),
      OrderingClosedForSubmissionError
    );
  });

  it("rejects a scheduled or forced online OPEN while the restaurant is closed", () => {
    for (const reason of ["SCHEDULE_OPEN", "FORCED_OPEN"]) {
      const combined = combineBusinessAndOnlineOrderingState({
        onlineState: online(true, { reason, source: reason === "FORCED_OPEN" ? "OVERRIDE" : "SCHEDULE" }),
        businessState: physical("2026-09-01T18:00:00.000Z"),
      });
      assert.equal(combined.acceptingOrders, false);
      assert.equal(combined.reason, "RESTAURANT_CLOSED");
      assert.equal(combined.onlineReason, reason);
    }
  });

  it("keeps emergency pause online-only and leaves the physical schedule unchanged", () => {
    const businessBefore = physical("2026-08-31T18:00:00.000Z");
    const combined = combineBusinessAndOnlineOrderingState({
      onlineState: online(false, { reason: "EMERGENCY_PAUSED", source: "EMERGENCY_PAUSE" }),
      businessState: businessBefore,
    });
    assert.equal(combined.acceptingOrders, false);
    assert.equal(combined.restaurantOpen, true);
    assert.equal(physical("2026-08-31T18:00:00.000Z").restaurantOpen, true);
  });

  it("presents physical and online status as distinct customer-facing facts", () => {
    const physicallyOpen = combineBusinessAndOnlineOrderingState({
      onlineState: online(false),
      businessState: physical("2026-08-31T18:00:00.000Z"),
    });
    const openPresentation = presentPublicOrderingState(physicallyOpen);
    assert.equal(openPresentation.message, "Online ordering is currently closed.");
    assert.equal(openPresentation.secondary, "Kobby’s Kitchen is open until 12:00 AM.");

    const tuesday = combineBusinessAndOnlineOrderingState({
      onlineState: online(true, { reason: "FORCED_OPEN", source: "OVERRIDE" }),
      businessState: physical("2026-09-01T12:00:00.000Z"),
    });
    const closedPresentation = presentPublicOrderingState(tuesday);
    assert.match(closedPresentation.message, /Kobby’s Kitchen is currently closed/i);
    assert.equal(closedPresentation.detail, "Kobby’s Kitchen reopens Wednesday at 4:00 PM.");
  });
});
