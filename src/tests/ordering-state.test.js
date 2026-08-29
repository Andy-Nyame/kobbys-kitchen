import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEVELOPMENT_BRANCH_FINGERPRINT,
  PRODUCTION_BRANCH_FINGERPRINT,
  assertDevelopmentBranchFingerprint,
} from "../../scripts/database-safety.js";
import {
  ORDERING_TIME_ZONE,
  OrderingClosedForSubmissionError,
  assertOrderingStateOpenForSubmission,
  resolveEffectiveOrderingState,
  validateOrderingOverride,
  validateOrderingSchedule,
} from "../lib/ordering/state.js";

const mondayWindow = {
  dayOfWeek: 1,
  startMinute: 10 * 60,
  endMinute: 20 * 60,
  sortOrder: 0,
};

function resolve(overrides = {}) {
  return resolveEffectiveOrderingState({
    featureEnabled: true,
    setting: {
      emergencyPaused: false,
      overrideMode: "NONE",
      overrideExpiresAt: null,
    },
    scheduleWindows: [mondayWindow],
    now: new Date("2026-08-31T12:00:00.000Z"),
    ...overrides,
  });
}

describe("ordering environment safety", () => {
  it("accepts only the pinned Development branch fingerprint", () => {
    assert.doesNotThrow(() =>
      assertDevelopmentBranchFingerprint(DEVELOPMENT_BRANCH_FINGERPRINT)
    );
  });

  it("explicitly rejects the pinned Production branch fingerprint", () => {
    assert.throws(
      () => assertDevelopmentBranchFingerprint(PRODUCTION_BRANCH_FINGERPRINT),
      /Production Neon branch/
    );
  });
});

describe("weekly ordering schedule validation", () => {
  it("supports multiple non-overlapping windows on the same day", () => {
    const windows = validateOrderingSchedule([
      { dayOfWeek: 1, startMinute: 780, endMinute: 900, sortOrder: 2 },
      { dayOfWeek: 1, startMinute: 600, endMinute: 720, sortOrder: 1 },
    ]);

    assert.deepEqual(
      windows.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })),
      [
        { startMinute: 600, endMinute: 720 },
        { startMinute: 780, endMinute: 900 },
      ]
    );
  });

  it("rejects overlapping windows while allowing adjacent windows", () => {
    assert.throws(
      () =>
        validateOrderingSchedule([
          { dayOfWeek: 1, startMinute: 600, endMinute: 720 },
          { dayOfWeek: 1, startMinute: 719, endMinute: 800 },
        ]),
      /cannot overlap/
    );
    assert.doesNotThrow(() =>
      validateOrderingSchedule([
        { dayOfWeek: 1, startMinute: 600, endMinute: 720 },
        { dayOfWeek: 1, startMinute: 720, endMinute: 800 },
      ])
    );
  });

  it("rejects overnight windows and malformed schedule values", () => {
    assert.throws(
      () => validateOrderingSchedule([{ dayOfWeek: 1, startMinute: 1200, endMinute: 600 }]),
      /Overnight/
    );
    assert.throws(
      () => validateOrderingSchedule([{ dayOfWeek: 8, startMinute: 600, endMinute: 700 }]),
      /Weekdays/
    );
  });

  it("rejects invalid override modes and expiries", () => {
    assert.throws(() => validateOrderingOverride({ mode: "MAYBE" }), /mode is invalid/);
    assert.throws(
      () => validateOrderingOverride({ mode: "OPEN", expiresAt: "not-a-date" }),
      /valid date/
    );
  });
});

describe("effective ordering state", () => {
  it("uses Africa/Accra explicitly", () => {
    assert.equal(ORDERING_TIME_ZONE, "Africa/Accra");
    assert.equal(resolve().reason, "SCHEDULE_OPEN");
  });

  it("keeps the deployment flag as the master kill switch", () => {
    const state = resolve({
      featureEnabled: false,
      setting: { emergencyPaused: false, overrideMode: "OPEN" },
    });

    assert.equal(state.acceptingOrders, false);
    assert.equal(state.reason, "BUILD_DISABLED");
    assert.equal(state.source, "BUILD_FLAG");
  });

  it("opens and closes from the weekly schedule", () => {
    assert.equal(resolve().acceptingOrders, true);
    assert.equal(
      resolve({ now: new Date("2026-09-01T12:00:00.000Z") }).acceptingOrders,
      false
    );
  });

  it("uses exact [start, end) boundary semantics", () => {
    assert.equal(
      resolve({ now: new Date("2026-08-31T09:59:59.000Z") }).acceptingOrders,
      false
    );
    assert.equal(
      resolve({ now: new Date("2026-08-31T10:00:00.000Z") }).acceptingOrders,
      true
    );
    assert.equal(
      resolve({ now: new Date("2026-08-31T19:59:59.000Z") }).acceptingOrders,
      true
    );
    assert.equal(
      resolve({ now: new Date("2026-08-31T20:00:00.000Z") }).acceptingOrders,
      false
    );
  });

  it("evaluates separate windows independently", () => {
    const windows = [
      { dayOfWeek: 1, startMinute: 600, endMinute: 720 },
      { dayOfWeek: 1, startMinute: 780, endMinute: 900 },
    ];

    assert.equal(
      resolve({ scheduleWindows: windows, now: new Date("2026-08-31T11:00:00Z") })
        .acceptingOrders,
      true
    );
    assert.equal(
      resolve({ scheduleWindows: windows, now: new Date("2026-08-31T12:30:00Z") })
        .acceptingOrders,
      false
    );
    assert.equal(
      resolve({ scheduleWindows: windows, now: new Date("2026-08-31T14:00:00Z") })
        .acceptingOrders,
      true
    );
  });

  it("honors forced OPEN and forced CLOSED overrides", () => {
    assert.equal(
      resolve({
        scheduleWindows: [],
        setting: { emergencyPaused: false, overrideMode: "OPEN" },
      }).reason,
      "FORCED_OPEN"
    );
    assert.equal(
      resolve({
        setting: { emergencyPaused: false, overrideMode: "CLOSED" },
      }).reason,
      "FORCED_CLOSED"
    );
  });

  it("ignores an expired override automatically", () => {
    const state = resolve({
      setting: {
        emergencyPaused: false,
        overrideMode: "CLOSED",
        overrideExpiresAt: new Date("2026-08-31T11:59:59Z"),
      },
    });

    assert.equal(state.acceptingOrders, true);
    assert.equal(state.overrideActive, false);
    assert.equal(state.source, "SCHEDULE");
  });

  it("emergency pause closes immediately and resume restores schedule evaluation", () => {
    const paused = resolve({
      setting: { emergencyPaused: true, overrideMode: "OPEN" },
    });
    const resumed = resolve({
      setting: { emergencyPaused: false, overrideMode: "NONE" },
    });

    assert.equal(paused.acceptingOrders, false);
    assert.equal(paused.reason, "EMERGENCY_PAUSED");
    assert.equal(resumed.acceptingOrders, true);
    assert.equal(resumed.reason, "SCHEDULE_OPEN");
  });

  it("enforces build, emergency, CLOSED override, OPEN override, then schedule precedence", () => {
    assert.equal(
      resolve({
        featureEnabled: false,
        setting: { emergencyPaused: true, overrideMode: "OPEN" },
      }).reason,
      "BUILD_DISABLED"
    );
    assert.equal(
      resolve({ setting: { emergencyPaused: true, overrideMode: "OPEN" } }).reason,
      "EMERGENCY_PAUSED"
    );
    assert.equal(
      resolve({ setting: { emergencyPaused: false, overrideMode: "CLOSED" } }).reason,
      "FORCED_CLOSED"
    );
    assert.equal(
      resolve({ setting: { emergencyPaused: false, overrideMode: "OPEN" } }).reason,
      "FORCED_OPEN"
    );
    assert.equal(resolve().reason, "SCHEDULE_OPEN");
  });

  it("calculates the next weekly open and close boundaries", () => {
    const beforeOpening = resolve({ now: new Date("2026-08-31T09:00:00Z") });
    const afterOpening = resolve({ now: new Date("2026-08-31T11:00:00Z") });

    assert.equal(beforeOpening.nextOpenAt, "2026-08-31T10:00:00.000Z");
    assert.equal(afterOpening.nextCloseAt, "2026-08-31T20:00:00.000Z");
  });

  it("fails closed for malformed stored schedule configuration", () => {
    const state = resolve({
      scheduleWindows: [{ dayOfWeek: 1, startMinute: 800, endMinute: 700 }],
    });

    assert.equal(state.acceptingOrders, false);
    assert.equal(state.reason, "CONFIGURATION_INVALID");
  });
});

describe("future submission guard", () => {
  it("allows a new submission only while effective state is open", () => {
    const state = resolve();

    assert.equal(assertOrderingStateOpenForSubmission(state), state);
  });

  it("returns a safe domain error while effective state is closed", () => {
    const state = resolve({ featureEnabled: false });

    assert.throws(
      () => assertOrderingStateOpenForSubmission(state),
      (error) =>
        error instanceof OrderingClosedForSubmissionError &&
        error.code === "ORDERING_CLOSED" &&
        error.reason === "BUILD_DISABLED"
    );
  });

  it("does not mutate an order that was accepted before ordering closed", () => {
    const acceptedOrders = ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"].map(
      (status) => Object.freeze({ id: `existing-${status.toLowerCase()}`, status })
    );
    const before = acceptedOrders.map((order) => ({ ...order }));

    assert.throws(() =>
      assertOrderingStateOpenForSubmission(resolve({ featureEnabled: false }))
    );
    assert.deepEqual(acceptedOrders, before);
  });
});
