import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { getAdminAuthorization } from "../lib/auth/authorization.js";
import { executeAdminBusinessHoursMutation } from "../lib/business-hours/admin-mutations.js";
import {
  BUSINESS_HOURS_ADMIN_ACTION,
  prepareBusinessHoursMutation,
  serializeBusinessHoursForEditor,
} from "../lib/business-hours/admin-validation.js";

const adminId = "11111111-1111-4111-8111-111111111111";

function fakeDatabase(role = "ADMIN") {
  const state = {
    windows: [],
    setting: { id: "default", changedById: null },
    touched: new Set(),
    orders: [{ id: "preserved-order" }],
    payments: [{ id: "preserved-payment" }],
    orderingWindows: [{ id: "preserved-online-window" }],
  };
  const transaction = {
    user: { findUnique: async () => ({ role }) },
    businessHoursSetting: {
      upsert: async () => ({ id: "default" }),
      update: async ({ data }) => {
        state.touched.add("businessHoursSetting");
        state.setting = { ...state.setting, ...data };
      },
    },
    businessHoursWindow: {
      deleteMany: async () => {
        state.touched.add("businessHoursWindow");
        state.windows = [];
      },
      createMany: async ({ data }) => {
        state.touched.add("businessHoursWindow");
        state.windows = data;
      },
    },
  };
  return {
    state,
    prismaClient: { $transaction: async (callback) => callback(transaction) },
  };
}

describe("admin physical business hours", () => {
  it("keeps route authorization ADMIN-only", () => {
    assert.equal(getAdminAuthorization(null, null, "/admin/settings").allowed, false);
    assert.equal(getAdminAuthorization({ id: "customer" }, "CUSTOMER", "/admin/settings").allowed, false);
    assert.equal(getAdminAuthorization({ id: adminId }, "ADMIN", "/admin/settings").allowed, true);
  });

  it("accepts overnight midnight closing and serializes Tuesday closed", () => {
    const mutation = prepareBusinessHoursMutation({
      action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
      windows: [{ dayOfWeek: 1, startTime: "16:00", endTime: "00:00" }],
    });
    assert.equal(mutation.data.windows[0].endsNextDay, true);
    const schedule = serializeBusinessHoursForEditor(mutation.data.windows);
    assert.deepEqual(schedule[1], [{ startTime: "16:00", endTime: "00:00" }]);
    assert.deepEqual(schedule[2], []);
  });

  it("rejects overlap, equal times, malformed days and trusted-field injection", () => {
    assert.throws(() => prepareBusinessHoursMutation({
      action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
      windows: [
        { dayOfWeek: 1, startTime: "16:00", endTime: "00:00" },
        { dayOfWeek: 1, startTime: "18:00", endTime: "22:00" },
      ],
    }), /overlap/);
    assert.throws(() => prepareBusinessHoursMutation({
      action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
      windows: [{ dayOfWeek: 2, startTime: "10:00", endTime: "10:00" }],
    }), /cannot be the same/);
    assert.throws(() => prepareBusinessHoursMutation({
      action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
      windows: [{ dayOfWeek: 9, startTime: "10:00", endTime: "12:00" }],
    }), /weekdays/i);
    assert.throws(() => prepareBusinessHoursMutation({
      action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
      role: "ADMIN",
      windows: [],
    }), /cannot be supplied/);
  });

  it("re-checks ADMIN and mutates only business-hours records", async () => {
    const mutation = prepareBusinessHoursMutation({
      action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
      windows: [{ dayOfWeek: 3, startTime: "16:00", endTime: "00:00" }],
    });
    const denied = fakeDatabase("CUSTOMER");
    await assert.rejects(executeAdminBusinessHoursMutation({
      prismaClient: denied.prismaClient,
      adminUserId: adminId,
      mutation,
    }), /Admin authorization/);

    const allowed = fakeDatabase();
    await executeAdminBusinessHoursMutation({
      prismaClient: allowed.prismaClient,
      adminUserId: adminId,
      mutation,
    });
    assert.deepEqual([...allowed.state.touched].sort(), ["businessHoursSetting", "businessHoursWindow"]);
    assert.equal(allowed.state.setting.changedById, adminId);
    assert.equal(allowed.state.orders[0].id, "preserved-order");
    assert.equal(allowed.state.payments[0].id, "preserved-payment");
    assert.equal(allowed.state.orderingWindows[0].id, "preserved-online-window");
  });

  it("keeps Business Hours in Settings and Online Ordering Hours in Operations", async () => {
    const [settings, operations] = await Promise.all([
      readFile("src/app/admin/settings/page.js", "utf8"),
      readFile("src/components/admin/AdminOperationsManager.jsx", "utf8"),
    ]);
    assert.match(settings, /title="Business Hours"/);
    assert.match(settings, /physically open/);
    assert.match(operations, /Online Ordering Hours/);
    assert.doesNotMatch(operations, /<h2[^>]*>Opening Hours/);
  });
});
