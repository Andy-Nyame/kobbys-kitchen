import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { startOrderPreparation } from "../lib/kitchen/service.js";
import { sortActiveKitchenOrders } from "../lib/kitchen/queue.js";
import { canTransitionOrderStatus } from "../lib/orders/domain.js";
import { formatOrderLabel } from "../lib/orders/presentation.js";

function preparationDatabase({
  role = "CHEF",
  initialStatus = "CONFIRMED",
  changedCount = 1,
} = {}) {
  const state = {
    status: initialStatus,
    history: [],
    updates: [],
    pickupCode: null,
  };
  const transaction = {
    user: { findUnique: async () => ({ role }) },
    order: {
      findUnique: async () => ({
        id: "order-1",
        reference: "KK-20260831-PREP1",
        status: state.status,
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

describe("trusted kitchen preparation transition", () => {
  it("allows a trusted CHEF or ADMIN to move CONFIRMED to PREPARING with actor history", async () => {
    for (const role of ["CHEF", "ADMIN"]) {
      const { client, state } = preparationDatabase({ role });
      const now = new Date("2026-08-31T19:00:00.000Z");
      const result = await startOrderPreparation({
        prismaClient: client,
        actorId: `${role.toLowerCase()}-1`,
        reference: "KK-20260831-PREP1",
        now,
      });

      assert.deepEqual(result, {
        reference: "KK-20260831-PREP1",
        previousStatus: "CONFIRMED",
        status: "PREPARING",
      });
      assert.equal(state.status, "PREPARING");
      assert.deepEqual(state.updates[0].data, { status: "PREPARING" });
      assert.deepEqual(state.history, [{
        orderId: "order-1",
        fromStatus: "CONFIRMED",
        toStatus: "PREPARING",
        changedById: `${role.toLowerCase()}-1`,
        changedAt: now,
      }]);
      assert.equal(state.pickupCode, null);
    }
  });

  it("denies CUSTOMER and every invalid source state", async () => {
    const customer = preparationDatabase({ role: "CUSTOMER" });
    await assert.rejects(
      startOrderPreparation({
        prismaClient: customer.client,
        actorId: "customer-1",
        reference: "KK-20260831-PREP1",
      }),
      (error) => error.code === "KITCHEN_REQUIRED" && error.status === 403
    );

    for (const initialStatus of [
      "PENDING",
      "PREPARING",
      "READY_FOR_PICKUP",
      "COMPLETED",
      "CANCELLED",
    ]) {
      const { client, state } = preparationDatabase({ initialStatus });
      await assert.rejects(
        startOrderPreparation({
          prismaClient: client,
          actorId: "chef-1",
          reference: "KK-20260831-PREP1",
        }),
        (error) => error.code === "INVALID_ORDER_STATE"
      );
      assert.equal(state.history.length, 0);
    }
  });

  it("uses compare-and-set protection and records no history for a stale update", async () => {
    const { client, state } = preparationDatabase({ changedCount: 0 });
    await assert.rejects(
      startOrderPreparation({
        prismaClient: client,
        actorId: "chef-1",
        reference: "KK-20260831-PREP1",
      }),
      (error) => error.code === "STALE_ORDER"
    );
    assert.equal(state.history.length, 0);
  });

  it("enforces the linear domain lifecycle", () => {
    assert.equal(canTransitionOrderStatus("CONFIRMED", "PREPARING"), true);
    assert.equal(canTransitionOrderStatus("CONFIRMED", "READY_FOR_PICKUP"), false);
    assert.equal(canTransitionOrderStatus("PREPARING", "READY_FOR_PICKUP"), true);
  });
});

describe("kitchen preparation UI and live workflow wiring", () => {
  it("shows only Start Preparing for CONFIRMED and only Mark Ready for PREPARING", async () => {
    const [card, startButton, readyButton, preparationRoute] = await Promise.all([
      readFile("src/components/kitchen/KitchenOrderCard.jsx", "utf8"),
      readFile("src/components/kitchen/KitchenStartPreparingButton.jsx", "utf8"),
      readFile("src/components/kitchen/KitchenReadyButton.jsx", "utf8"),
      readFile("src/app/api/kitchen/orders/[reference]/preparing/route.js", "utf8"),
    ]);

    assert.match(card, /order\.status === "CONFIRMED"[\s\S]*KitchenStartPreparingButton/);
    assert.match(card, /order\.status === "PREPARING"[\s\S]*KitchenReadyButton/);
    assert.match(startButton, /"Start Preparing"/);
    assert.match(startButton, /Starting…/);
    assert.match(startButton, /disabled=\{pending\}/);
    assert.match(startButton, /\/preparing/);
    assert.match(readyButton, /"Mark Ready for Pickup"/);
    assert.match(readyButton, /disabled=\{pending\}/);
    assert.match(preparationRoute, /role !== "ADMIN" && role !== "CHEF"/);
    assert.match(preparationRoute, /actorId: user\.id/);
  });

  it("keeps the active queue FIFO when an accepted order changes to PREPARING", () => {
    const acceptedAt = "2026-08-31T18:00:00.000Z";
    const orders = [
      { reference: "KK-2", status: "CONFIRMED", acceptedAt: "2026-08-31T18:20:00.000Z" },
      { reference: "KK-1", status: "CONFIRMED", acceptedAt },
    ];
    assert.deepEqual(sortActiveKitchenOrders(orders).map((order) => order.reference), ["KK-1", "KK-2"]);
    orders[1] = { ...orders[1], status: "PREPARING", acceptedAt };
    assert.deepEqual(sortActiveKitchenOrders(orders).map((order) => order.reference), ["KK-1", "KK-2"]);
  });

  it("uses distinct customer wording and preserves quiet operational refresh wiring", async () => {
    const [kitchenPage, customerLayout, adminOrders] = await Promise.all([
      readFile("src/app/kitchen/page.js", "utf8"),
      readFile("src/app/(customer)/layout.js", "utf8"),
      readFile("src/app/admin/orders/page.js", "utf8"),
    ]);

    assert.equal(formatOrderLabel("PENDING"), "Order Placed / Awaiting Confirmation");
    assert.equal(formatOrderLabel("CONFIRMED"), "Order Accepted");
    assert.equal(formatOrderLabel("PREPARING"), "Food is being prepared");
    assert.match(kitchenPage, /OperationalAutoRefresh exactPaths=\{\["\/kitchen"\]\}/);
    assert.match(customerLayout, /OperationalStatusProvider/);
    assert.match(customerLayout, /refreshServerPrefixPaths=\{\["\/account\/orders\/"\]\}/);
    assert.match(adminOrders, /OperationalAutoRefresh/);
  });
});
