import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  ADMIN_ORDER_ACTION,
  prepareAdminOrderMutation,
} from "../lib/orders/admin-domain.js";
import {
  AdminOrderMutationError,
  executeAdminOrderMutation,
} from "../lib/orders/admin-mutations.js";
import { ORDER_STATUS, canTransitionOrderStatus } from "../lib/orders/domain.js";
import { getOrderProgress } from "../lib/orders/presentation.js";

function createTransaction({ role = "ADMIN", initialStatus = "PENDING", changedCount = 1 } = {}) {
  const state = {
    status: initialStatus,
    paymentStatus: "UNPAID",
    updates: [],
    history: [],
  };
  const transaction = {
    user: { findUnique: async () => ({ role }) },
    order: {
      findUnique: async () => ({
        id: "10000000-0000-4000-8000-000000000001",
        reference: "KK-20260829-TEST1",
        status: state.status,
        paymentStatus: state.paymentStatus,
      }),
      updateMany: async ({ where, data }) => {
        state.updates.push({ where, data });
        if (changedCount !== 1 || where.status !== state.status) return { count: 0 };
        state.status = data.status;
        return { count: 1 };
      },
    },
    orderStatusHistory: {
      create: async ({ data }) => {
        state.history.push(data);
        return data;
      },
    },
  };
  return {
    state,
    client: { $transaction: async (callback) => callback(transaction) },
  };
}

describe("trusted operational order transitions", () => {
  it("allows only the linear lifecycle and bounded cancellation states", () => {
    assert.equal(canTransitionOrderStatus(ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED), true);
    assert.equal(canTransitionOrderStatus(ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING), true);
    assert.equal(canTransitionOrderStatus(ORDER_STATUS.CONFIRMED, ORDER_STATUS.READY_FOR_PICKUP), false);
    assert.equal(canTransitionOrderStatus(ORDER_STATUS.PREPARING, ORDER_STATUS.READY_FOR_PICKUP), true);
    assert.equal(canTransitionOrderStatus(ORDER_STATUS.READY_FOR_PICKUP, ORDER_STATUS.COMPLETED), true);
    for (const status of [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING]) {
      assert.equal(canTransitionOrderStatus(status, ORDER_STATUS.CANCELLED), true);
    }
    for (const [from, to] of [
      ["PENDING", "PREPARING"],
      ["PENDING", "COMPLETED"],
      ["PREPARING", "COMPLETED"],
      ["READY_FOR_PICKUP", "PREPARING"],
      ["COMPLETED", "PREPARING"],
      ["CANCELLED", "PREPARING"],
      ["CANCELLED", "CONFIRMED"],
      ["READY_FOR_PICKUP", "CANCELLED"],
    ]) assert.equal(canTransitionOrderStatus(from, to), false, `${from} -> ${to}`);
  });

  it("maps browser actions to trusted statuses and rejects role or actor injection", () => {
    assert.deepEqual(prepareAdminOrderMutation({ reference: "kk-20260829-test1", action: ADMIN_ORDER_ACTION.ACCEPT }), {
      action: "ACCEPT",
      reference: "KK-20260829-TEST1",
      nextStatus: "CONFIRMED",
      cancellationReason: null,
    });
    for (const field of ["role", "actorId", "adminUserId", "changedById", "userId"]) {
      assert.throws(() => prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action: "ACCEPT", [field]: "ADMIN" }), /cannot be supplied/);
    }
    assert.throws(() => prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action: "PROMOTE" }), /not supported/);
  });

  it("executes admin acceptance/preparation but refuses the old completion shortcut", async () => {
    const { client, state } = createTransaction();
    const now = new Date("2026-08-29T19:00:00.000Z");
    for (const action of ["ACCEPT", "START_PREPARING"]) {
      const mutation = prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action });
      const result = await executeAdminOrderMutation({ prismaClient: client, adminUserId: "admin-1", mutation, now });
      assert.equal(result.paymentStatus, "UNPAID");
    }
    assert.throws(() => prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action: "COMPLETE" }), /not supported/);
    assert.equal(state.status, "PREPARING");
    assert.equal(state.paymentStatus, "UNPAID");
    assert.equal(state.history.length, 2);
    assert.ok(state.history.every((event) => event.changedById === "admin-1"));
    assert.ok(state.updates.every((entry) => !("paymentStatus" in entry.data)));
  });

  it("denies a CUSTOMER and rejects a stale concurrent update", async () => {
    const customer = createTransaction({ role: "CUSTOMER" });
    await assert.rejects(
      executeAdminOrderMutation({ prismaClient: customer.client, adminUserId: "customer-1", mutation: prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action: "ACCEPT" }) }),
      (error) => error instanceof AdminOrderMutationError && error.status === 403
    );
    const stale = createTransaction({ changedCount: 0 });
    await assert.rejects(
      executeAdminOrderMutation({ prismaClient: stale.client, adminUserId: "admin-1", mutation: prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action: "ACCEPT" }) }),
      (error) => error.code === "STALE_ORDER"
    );
    assert.equal(stale.state.history.length, 0);
  });

  it("records a short cancellation reason and stops the customer tracker", async () => {
    const { client, state } = createTransaction({ initialStatus: "PREPARING" });
    const mutation = prepareAdminOrderMutation({ reference: "KK-20260829-TEST1", action: "CANCEL", cancellationReason: "  Item unavailable  " });
    await executeAdminOrderMutation({ prismaClient: client, adminUserId: "admin-1", mutation });
    assert.equal(state.status, "CANCELLED");
    assert.equal(state.updates[0].data.cancellationReason, "Item unavailable");
    assert.deepEqual(getOrderProgress("CANCELLED"), { cancelled: true, currentIndex: -1, steps: [] });
  });
});

describe("customer and admin order experience wiring", () => {
  it("uses authenticated ownership, current catalogue data for Order Again, and no direct creation", async () => {
    const [queries, detail, again] = await Promise.all([
      readFile(new URL("../lib/orders/customer-orders.js", import.meta.url), "utf8"),
      readFile(new URL("../app/(customer)/account/orders/[reference]/page.js", import.meta.url), "utf8"),
      readFile(new URL("../components/orders/OrderAgainButton.jsx", import.meta.url), "utf8"),
    ]);
    assert.match(queries, /where: \{ userId, reference \}/);
    assert.match(queries, /priceStepMinor/);
    assert.match(detail, /deriveMenuPriceMinor/);
    assert.match(detail, /unavailableReorderCount/);
    assert.match(again, /replaceCart/);
    assert.doesNotMatch(again, /fetch\(|order\.create|\/api\/checkout/);
  });

  it("keeps admin mutations server-authorized and customer progress accessible", async () => {
    const [route, actions, tracker, adminPage] = await Promise.all([
      readFile(new URL("../app/api/admin/orders/[reference]/status/route.js", import.meta.url), "utf8"),
      readFile(new URL("../components/admin/AdminOrderActions.jsx", import.meta.url), "utf8"),
      readFile(new URL("../components/orders/OrderTracker.jsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/orders/page.js", import.meta.url), "utf8"),
    ]);
    assert.match(route, /getAdminAuthorization/);
    assert.match(route, /mutateAdminOrder/);
    assert.match(actions, /Accept Order/);
    assert.match(actions, /Start Preparing/);
    assert.match(actions, /Mark Ready for Pickup/);
    assert.doesNotMatch(actions, /Complete Order/);
    assert.match(adminPage, /PickupVerification/);
    assert.match(tracker, /aria-current/);
    assert.match(tracker, /Order Cancelled/);
    assert.match(adminPage, /New Orders/);
    assert.match(adminPage, /In Progress/);
  });
});
