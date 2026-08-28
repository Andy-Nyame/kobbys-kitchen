import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { getAdminAuthorization } from "../lib/auth/authorization.js";
import { executeAdminOrderingMutation } from "../lib/ordering/admin-mutations.js";
import {
  ORDERING_ADMIN_ACTION,
  prepareOrderingAdminMutation,
  serializeScheduleForEditor,
} from "../lib/ordering/admin-validation.js";
import { resolveEffectiveOrderingState } from "../lib/ordering/state.js";

const adminId = "11111111-1111-4111-8111-111111111111";

function makeDatabase({ role = "ADMIN" } = {}) {
  const state = {
    setting: {
      id: "default",
      emergencyPaused: false,
      overrideMode: "NONE",
      overrideExpiresAt: null,
      changedById: null,
      unrelated: "preserved",
    },
    windows: [],
    orders: [{ id: "existing-order", status: "PENDING" }],
    payments: [{ id: "existing-payment", status: "PENDING" }],
    carts: [{ id: "browser-cart" }],
    touchedModels: new Set(),
  };

  const transaction = {
    user: {
      findUnique: async () => {
        state.touchedModels.add("user");
        return role ? { role } : null;
      },
    },
    orderingSetting: {
      upsert: async ({ create }) => {
        state.touchedModels.add("orderingSetting");
        if (!state.setting) state.setting = { ...create };
        return { id: "default" };
      },
      update: async ({ data }) => {
        state.touchedModels.add("orderingSetting");
        state.setting = { ...state.setting, ...data };
        return { id: "default" };
      },
    },
    orderingScheduleWindow: {
      deleteMany: async () => {
        state.touchedModels.add("orderingScheduleWindow");
        state.windows = [];
        return { count: 0 };
      },
      createMany: async ({ data }) => {
        state.touchedModels.add("orderingScheduleWindow");
        state.windows = data.map((window) => ({ ...window }));
        return { count: data.length };
      },
    },
  };
  const prismaClient = { $transaction: async (callback) => callback(transaction) };

  return { prismaClient, state };
}

function scheduleMutation(windows) {
  return prepareOrderingAdminMutation({
    action: ORDERING_ADMIN_ACTION.SAVE_SCHEDULE,
    windows,
  });
}

describe("admin ordering operations authorization", () => {
  it("denies signed-out and CUSTOMER contexts while allowing ADMIN", () => {
    assert.equal(getAdminAuthorization(null, null, "/admin/operations").allowed, false);
    assert.equal(
      getAdminAuthorization({ id: "customer" }, "CUSTOMER", "/admin/operations").allowed,
      false
    );
    assert.equal(
      getAdminAuthorization({ id: adminId }, "ADMIN", "/admin/operations").allowed,
      true
    );
  });

  it("re-checks the trusted database role inside every mutation transaction", async () => {
    const { prismaClient } = makeDatabase({ role: "CUSTOMER" });

    await assert.rejects(
      executeAdminOrderingMutation({
        prismaClient,
        adminUserId: adminId,
        mutation: { action: ORDERING_ADMIN_ACTION.PAUSE, data: {} },
      }),
      /Admin authorization is required/
    );
  });

  it("rejects browser role and actor injection", () => {
    for (const injected of [
      { role: "ADMIN" },
      { userId: adminId },
      { changedById: adminId },
    ]) {
      assert.throws(
        () =>
          prepareOrderingAdminMutation({
            action: ORDERING_ADMIN_ACTION.PAUSE,
            ...injected,
          }),
        /cannot be supplied/
      );
    }
  });
});

describe("admin weekly ordering schedule", () => {
  it("serializes an existing schedule for all seven editor days", () => {
    const schedule = serializeScheduleForEditor([
      { dayOfWeek: 1, startMinute: 600, endMinute: 720, sortOrder: 0 },
    ]);

    assert.deepEqual(schedule[1], [{ startTime: "10:00", endTime: "12:00" }]);
    assert.deepEqual(schedule[2], []);
    assert.equal(Object.keys(schedule).length, 7);
  });

  it("saves a valid schedule and multiple windows transactionally", async () => {
    const mutation = scheduleMutation([
      { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "13:00", endTime: "20:00" },
      { dayOfWeek: 7, startTime: "11:00", endTime: "15:00" },
    ]);
    const { prismaClient, state } = makeDatabase();

    const result = await executeAdminOrderingMutation({
      prismaClient,
      adminUserId: adminId,
      mutation,
    });

    assert.equal(result.windowCount, 3);
    assert.equal(state.windows.length, 3);
    assert.equal(state.windows[1].startMinute, 780);
    assert.equal(state.setting.changedById, adminId);
    assert.equal(state.setting.unrelated, "preserved");
  });

  it("rejects overlap, duplicates, overnight ranges and invalid ranges", () => {
    assert.throws(
      () =>
        scheduleMutation([
          { dayOfWeek: 2, startTime: "10:00", endTime: "13:00" },
          { dayOfWeek: 2, startTime: "12:00", endTime: "14:00" },
        ]),
      /overlap/
    );
    assert.throws(
      () =>
        scheduleMutation([
          { dayOfWeek: 2, startTime: "10:00", endTime: "13:00" },
          { dayOfWeek: 2, startTime: "10:00", endTime: "13:00" },
        ]),
      /overlap/
    );
    assert.throws(
      () => scheduleMutation([{ dayOfWeek: 3, startTime: "20:00", endTime: "10:00" }]),
      /Overnight/
    );
    assert.throws(
      () => scheduleMutation([{ dayOfWeek: 8, startTime: "10:00", endTime: "11:00" }]),
      /Weekdays/
    );
    assert.doesNotThrow(() =>
      scheduleMutation([
        { dayOfWeek: 4, startTime: "10:00", endTime: "12:00" },
        { dayOfWeek: 4, startTime: "12:00", endTime: "14:00" },
      ])
    );
  });
});

describe("admin overrides and emergency controls", () => {
  it("parses OPEN/CLOSED expiry in Africa/Accra and rejects expired values", () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    const open = prepareOrderingAdminMutation(
      {
        action: ORDERING_ADMIN_ACTION.SET_OVERRIDE,
        mode: "OPEN",
        expiresAt: "2026-08-28T18:30",
      },
      { now }
    );
    const closed = prepareOrderingAdminMutation(
      {
        action: ORDERING_ADMIN_ACTION.SET_OVERRIDE,
        mode: "CLOSED",
        expiresAt: "",
      },
      { now }
    );

    assert.equal(open.data.expiresAt.toISOString(), "2026-08-28T18:30:00.000Z");
    assert.equal(closed.data.expiresAt, null);
    assert.throws(
      () =>
        prepareOrderingAdminMutation(
          {
            action: ORDERING_ADMIN_ACTION.SET_OVERRIDE,
            mode: "OPEN",
            expiresAt: "2026-08-28T11:59",
          },
          { now }
        ),
      /future/
    );
  });

  it("sets OPEN, sets CLOSED and clears the existing override", async () => {
    const { prismaClient, state } = makeDatabase();

    for (const mode of ["OPEN", "CLOSED"]) {
      await executeAdminOrderingMutation({
        prismaClient,
        adminUserId: adminId,
        mutation: {
          action: ORDERING_ADMIN_ACTION.SET_OVERRIDE,
          data: { mode, expiresAt: null },
        },
      });
      assert.equal(state.setting.overrideMode, mode);
    }

    await executeAdminOrderingMutation({
      prismaClient,
      adminUserId: adminId,
      mutation: { action: ORDERING_ADMIN_ACTION.CLEAR_OVERRIDE, data: {} },
    });
    assert.equal(state.setting.overrideMode, "NONE");
    assert.equal(state.setting.overrideExpiresAt, null);
  });

  it("pauses and resumes without forcing ordering open", async () => {
    const { prismaClient, state } = makeDatabase();

    await executeAdminOrderingMutation({
      prismaClient,
      adminUserId: adminId,
      mutation: { action: ORDERING_ADMIN_ACTION.PAUSE, data: {} },
    });
    assert.equal(state.setting.emergencyPaused, true);

    await executeAdminOrderingMutation({
      prismaClient,
      adminUserId: adminId,
      mutation: { action: ORDERING_ADMIN_ACTION.RESUME, data: {} },
    });
    assert.equal(state.setting.emergencyPaused, false);
    assert.equal(state.setting.overrideMode, "NONE");
  });

  it("keeps B2-B1 precedence authoritative", () => {
    const state = resolveEffectiveOrderingState({
      featureEnabled: false,
      setting: { emergencyPaused: false, overrideMode: "OPEN", overrideExpiresAt: null },
      scheduleWindows: [],
      now: new Date("2026-08-28T12:00:00.000Z"),
    });
    assert.equal(state.acceptingOrders, false);
    assert.equal(state.reason, "BUILD_DISABLED");
  });

  it("attributes changes to the authenticated ADMIN and never mutates accepted orders, payments or carts", async () => {
    const { prismaClient, state } = makeDatabase();
    const before = JSON.stringify({
      orders: state.orders,
      payments: state.payments,
      carts: state.carts,
    });

    await executeAdminOrderingMutation({
      prismaClient,
      adminUserId: adminId,
      mutation: { action: ORDERING_ADMIN_ACTION.PAUSE, data: {} },
    });

    assert.equal(state.setting.changedById, adminId);
    assert.equal(
      JSON.stringify({ orders: state.orders, payments: state.payments, carts: state.carts }),
      before
    );
    assert.deepEqual(
      [...state.touchedModels].sort(),
      ["orderingSetting", "user"]
    );
  });
});

describe("admin ordering operations route and UI", () => {
  it("uses server guards, exposes the admin route in both navigation surfaces and has accessible confirmations", async () => {
    const [page, route, navigation, manager, workspace] = await Promise.all([
      readFile(new URL("../app/admin/operations/page.js", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/operations/route.js", import.meta.url), "utf8"),
      readFile(new URL("../components/admin/AdminNavigation.jsx", import.meta.url), "utf8"),
      readFile(new URL("../components/admin/AdminOperationsManager.jsx", import.meta.url), "utf8"),
      readFile(new URL("../components/admin/AdminWorkspace.jsx", import.meta.url), "utf8"),
    ]);

    assert.match(page, /requireAdmin\("\/admin\/operations"\)/);
    assert.match(route, /getAuthenticatedUser\(\)/);
    assert.match(route, /getUserRole\(user\.id\)/);
    assert.match(navigation, /href: "\/admin\/operations", label: "Operations"/);
    assert.equal((workspace.match(/<AdminNavigation/g) || []).length, 2);
    assert.match(manager, /role="alertdialog"/);
    assert.match(manager, /aria-modal="true"/);
    assert.match(manager, /Africa\/Accra/);
    assert.doesNotMatch(manager, /window\.confirm|alert\(/);
  });
});
