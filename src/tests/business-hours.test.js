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
  it("automatically follows a 2 PM–10 PM online window before and during physical hours", () => {
    const scheduleWindows = [
      { dayOfWeek: 1, startMinute: 14 * 60, endMinute: 22 * 60 },
      { dayOfWeek: 2, startMinute: 14 * 60, endMinute: 22 * 60 },
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

    assert.equal(combinedAt("2026-08-31T13:59:59.000Z").acceptingOrders, false);
    assert.equal(combinedAt("2026-08-31T14:00:00.000Z").acceptingOrders, true);
    assert.equal(combinedAt("2026-08-31T15:00:00.000Z").restaurantOpen, false);
    assert.equal(combinedAt("2026-08-31T15:00:00.000Z").acceptingOrders, true);
    assert.equal(combinedAt("2026-08-31T16:00:00.000Z").restaurantOpen, true);
    assert.equal(combinedAt("2026-08-31T16:00:00.000Z").acceptingOrders, true);
    assert.equal(combinedAt("2026-08-31T21:59:59.000Z").acceptingOrders, true);
    assert.equal(combinedAt("2026-08-31T22:00:00.000Z").acceptingOrders, false);
    assert.equal(combinedAt("2026-08-31T23:00:00.000Z").restaurantOpen, true);
    assert.equal(combinedAt("2026-08-31T23:00:00.000Z").acceptingOrders, false);
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

  it("allows checkout when online ordering is open on an operating day", () => {
    const combined = combineBusinessAndOnlineOrderingState({
      onlineState: online(true),
      businessState: physical("2026-08-31T15:00:00.000Z"),
    });
    assert.equal(combined.restaurantOpen, false);
    assert.equal(combined.businessDayClosed, false);
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

  it("rejects a scheduled or forced online OPEN on the Tuesday closed day", () => {
    for (const reason of ["SCHEDULE_OPEN", "FORCED_OPEN"]) {
      const combined = combineBusinessAndOnlineOrderingState({
        onlineState: online(true, { reason, source: reason === "FORCED_OPEN" ? "OVERRIDE" : "SCHEDULE" }),
        businessState: physical("2026-09-01T18:00:00.000Z"),
      });
      assert.equal(combined.acceptingOrders, false);
      assert.equal(combined.reason, "BUSINESS_DAY_CLOSED");
      assert.equal(combined.businessDayClosed, true);
      assert.equal(combined.onlineReason, reason);
      assert.throws(
        () => assertOrderingStateOpenForSubmission(combined),
        OrderingClosedForSubmissionError
      );
    }
  });

  it("keeps global, closed-day, pause and override precedence authoritative", () => {
    const mondayBeforeStorefront = physical("2026-08-31T15:00:00.000Z");
    const tuesday = physical("2026-09-01T15:00:00.000Z");

    const combine = (businessState, overrides) =>
      combineBusinessAndOnlineOrderingState({
        onlineState: online(true, overrides),
        businessState,
      });

    assert.equal(
      combine(mondayBeforeStorefront, { reason: "BUILD_DISABLED", source: "BUILD_FLAG" }).acceptingOrders,
      false
    );
    assert.equal(
      combine(tuesday, { reason: "FORCED_OPEN", source: "OVERRIDE" }).reason,
      "BUSINESS_DAY_CLOSED"
    );
    assert.equal(
      combine(mondayBeforeStorefront, { acceptingOrders: false, reason: "EMERGENCY_PAUSED", source: "EMERGENCY_PAUSE" }).acceptingOrders,
      false
    );
    assert.equal(
      combine(mondayBeforeStorefront, { acceptingOrders: false, reason: "FORCED_CLOSED", source: "OVERRIDE" }).acceptingOrders,
      false
    );
    assert.equal(
      combine(mondayBeforeStorefront, { reason: "FORCED_OPEN", source: "OVERRIDE" }).acceptingOrders,
      true
    );
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

  it("presents before, during and after-window states without GMT wording", () => {
    const scheduleWindows = [{ dayOfWeek: 1, startMinute: 14 * 60, endMinute: 22 * 60 }];
    const presentationAt = (value) => {
      const now = new Date(value);
      return presentPublicOrderingState(
        combineBusinessAndOnlineOrderingState({
          onlineState: resolveEffectiveOrderingState({
            featureEnabled: true,
            setting: { emergencyPaused: false, overrideMode: "NONE" },
            scheduleWindows,
            now,
          }),
          businessState: physical(value),
        })
      );
    };

    const before = presentationAt("2026-08-31T13:00:00.000Z");
    assert.equal(before.headline, "Online Ordering Closed");
    assert.equal(before.detail, "Online ordering opens today at 2:00 PM.");

    const during = presentationAt("2026-08-31T15:00:00.000Z");
    assert.equal(during.headline, "Online Ordering Open");
    assert.equal(during.message, "Place your order online and pick it up when it’s ready.");
    assert.equal(during.detail, "Online orders close at 10:00 PM.");
    assert.equal(during.restaurantOpen, false);

    const after = presentationAt("2026-08-31T22:00:00.000Z");
    assert.equal(after.headline, "Online Ordering Closed");
    assert.equal(
      after.message,
      "We’re no longer accepting new online orders today. Orders already placed will still be prepared for pickup before we close at 12:00 AM."
    );
    assert.doesNotMatch(JSON.stringify({ before, during, after }), /GMT/);

    const tuesday = combineBusinessAndOnlineOrderingState({
      onlineState: online(true, { reason: "FORCED_OPEN", source: "OVERRIDE" }),
      businessState: physical("2026-09-01T12:00:00.000Z"),
    });
    const closedPresentation = presentPublicOrderingState(tuesday);
    assert.equal(closedPresentation.headline, "Online Ordering Closed");
    assert.match(closedPresentation.message, /Kobby’s Kitchen is closed today/i);
    assert.equal(closedPresentation.secondary, "Kobby’s Kitchen reopens Wednesday at 4:00 PM.");
  });

  it("presents the deployment safety switch as a temporary closure, not an unreleased feature", () => {
    const presentation = presentPublicOrderingState({
      acceptingOrders: false,
      reason: "BUILD_DISABLED",
      restaurantOpen: true,
      businessNextCloseAt: new Date("2026-08-31T24:00:00.000Z"),
      currentTime: new Date("2026-08-31T18:00:00.000Z"),
    });

    assert.equal(presentation.headline, "Online Ordering Closed");
    assert.equal(presentation.message, "Online ordering is temporarily unavailable.");
    assert.doesNotMatch(JSON.stringify(presentation), /Coming Soon|not enabled yet/i);
  });
});
