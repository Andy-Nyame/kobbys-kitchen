import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  cleanupProductionTestOrders,
  PRODUCTION_TEST_ORDER_PURGE_CONFIRMATION,
  requirePaystackTestMode,
} from "../../scripts/production-test-order-cleanup.js";

const preserved = Object.freeze({
  users: 5,
  profiles: 5,
  authAccounts: 3,
  roles: { ADMIN: 1, CHEF: 1, CUSTOMER: 3 },
  menuCategories: 4,
  menuItems: 12,
  menuItemImages: 12,
  businessHoursSettings: 1,
  businessHoursWindows: 6,
  orderingSettings: 1,
  orderingScheduleWindows: 6,
  reviews: 2,
  reviewModeration: 1,
});

const initialTransactional = Object.freeze({
  orders: 2,
  orderItems: 4,
  orderStatusHistory: 5,
  payments: 2,
  paymentAttempts: 1,
  receipts: 1,
  refunds: 1,
  activePickupCredentials: 1,
});

function cleanupDouble() {
  const state = { ...initialTransactional };
  const deletes = [];
  const count = (key) => async () => state[key];
  const remove = (key) => async () => {
    deletes.push(key);
    const deleted = state[key];
    state[key] = 0;
    return { count: deleted };
  };
  const userCount = async (query) => {
    if (!query?.where?.role) return preserved.users;
    return preserved.roles[query.where.role];
  };
  const transaction = {
    user: { count: userCount },
    profile: { count: async () => preserved.profiles },
    account: { count: async () => preserved.authAccounts },
    menuCategory: { count: async () => preserved.menuCategories },
    menuItem: { count: async () => preserved.menuItems },
    menuItemImage: { count: async () => preserved.menuItemImages },
    businessHoursSetting: { count: async () => preserved.businessHoursSettings },
    businessHoursWindow: { count: async () => preserved.businessHoursWindows },
    orderingSetting: { count: async () => preserved.orderingSettings },
    orderingScheduleWindow: { count: async () => preserved.orderingScheduleWindows },
    review: { count: async () => preserved.reviews },
    reviewModeration: { count: async () => preserved.reviewModeration },
    order: {
      count: async (query) =>
        query?.where?.pickupCode && state.orders
          ? state.activePickupCredentials
          : state.orders,
      deleteMany: remove("orders"),
    },
    orderItem: { count: count("orderItems"), deleteMany: remove("orderItems") },
    orderStatusHistory: { count: count("orderStatusHistory"), deleteMany: remove("orderStatusHistory") },
    payment: { count: count("payments"), deleteMany: remove("payments") },
    paymentAttempt: { count: count("paymentAttempts"), deleteMany: remove("paymentAttempts") },
    receipt: { count: count("receipts"), deleteMany: remove("receipts") },
    refund: { count: count("refunds"), deleteMany: remove("refunds") },
  };
  const client = {
    ...transaction,
    $transaction: async (callback, options) => {
      assert.deepEqual(options, {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 30_000,
      });
      return callback(transaction);
    },
  };
  return { client, deletes, state };
}

const environment = Object.freeze({ PAYSTACK_SECRET_KEY: "sk_test_redacted" });
const verifyDatabase = async () => ({ verified: true });

describe("guarded Production test-order cleanup", () => {
  it("refuses Live, missing and unknown Paystack configurations", () => {
    assert.throws(
      () => requirePaystackTestMode({ PAYSTACK_SECRET_KEY: "sk_live_redacted" }),
      /LIVE CONFIGURATION DETECTED/,
    );
    assert.throws(() => requirePaystackTestMode({}), /could not be verified/);
    assert.throws(
      () => requirePaystackTestMode({ PAYSTACK_SECRET_KEY: "secret" }),
      /could not be verified/,
    );
  });

  it("is dry-run only by default and reports delete/preserve counts", async () => {
    const { client, deletes } = cleanupDouble();
    const result = await cleanupProductionTestOrders({
      argumentsList: [],
      environment,
      prismaClient: client,
      verifyDatabase,
      audit: () => {},
    });
    assert.equal(result.status, "dry_run");
    assert.deepEqual(result.delete, initialTransactional);
    assert.deepEqual(result.preserve, preserved);
    assert.deepEqual(deletes, []);
  });

  it("requires the exact confirmation flag before any deletion", async () => {
    const { client, deletes } = cleanupDouble();
    await assert.rejects(
      cleanupProductionTestOrders({
        argumentsList: ["--confirm"],
        environment,
        prismaClient: client,
        verifyDatabase,
      }),
      /without exactly --confirm-test-order-purge/,
    );
    assert.deepEqual(deletes, []);
  });

  it("purges only transaction-owned models in dependency order", async () => {
    const { client, deletes } = cleanupDouble();
    const result = await cleanupProductionTestOrders({
      argumentsList: [PRODUCTION_TEST_ORDER_PURGE_CONFIRMATION],
      environment,
      prismaClient: client,
      verifyDatabase,
      audit: () => {},
    });
    assert.equal(result.status, "purged");
    assert.deepEqual(deletes, [
      "refunds",
      "receipts",
      "paymentAttempts",
      "payments",
      "orderStatusHistory",
      "orderItems",
      "orders",
    ]);
    assert.deepEqual(result.after.delete, {
      orders: 0,
      orderItems: 0,
      orderStatusHistory: 0,
      payments: 0,
      paymentAttempts: 0,
      receipts: 0,
      refunds: 0,
      activePickupCredentials: 0,
    });
    assert.deepEqual(result.after.preserve, preserved);
  });

  it("wires an ignored Production env file and a dry-run-first package command", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    const runner = await readFile("scripts/cleanup-production-test-orders.js", "utf8");
    const command = packageJson.scripts["cleanup:test-orders:production"];
    assert.match(command, /--env-file-if-exists=\.env\.admin-production\.local/);
    assert.match(runner, /verifyProductionDatabase/);
    assert.match(runner, /override: true/);
    assert.doesNotMatch(runner, /db push|migrate reset|seed/);
  });
});
