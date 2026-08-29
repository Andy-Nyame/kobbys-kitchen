import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cleanupProductionDummyCustomers,
  PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION,
  requireCustomerCleanupConfirmation,
} from "../../scripts/production-customer-cleanup.js";

function cleanupMock({ orders = 0 } = {}) {
  const calls = [];
  const transaction = {
    user: {
      findMany: async (query) => {
        if (query.take === 2) {
          return [{
            id: "admin-id",
            email: "admin@example.test",
            profile: { id: "profile-id" },
            accounts: [{ id: "google-account" }],
          }];
        }
        return [{ id: "customer-one" }, { id: "customer-two" }];
      },
      count: async ({ where }) => (where.role === "ADMIN" ? 1 : calls.includes("deleted") ? 0 : 2),
      deleteMany: async (query) => {
        calls.push("deleted", query);
        return { count: 2 };
      },
      findUnique: async () => ({
        role: "ADMIN",
        profile: { id: "profile-id" },
        accounts: [{ id: "google-account" }],
      }),
    },
    order: { count: async () => orders },
    payment: { count: async () => 0 },
    paymentAttempt: { count: async () => 0 },
    review: { deleteMany: async () => ({ count: 0 }) },
  };

  return {
    calls,
    client: { $transaction: async (callback) => callback(transaction) },
  };
}

describe("guarded Production dummy-customer cleanup", () => {
  it("requires the exact explicit confirmation", () => {
    assert.throws(() => requireCustomerCleanupConfirmation([]), /Refusing Production cleanup/);
    assert.doesNotThrow(() =>
      requireCustomerCleanupConfirmation([PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION])
    );
  });

  it("refuses cleanup when commercial history exists", async () => {
    const { client, calls } = cleanupMock({ orders: 1 });
    await assert.rejects(
      cleanupProductionDummyCustomers({
        argumentsList: [PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION],
        environment: {},
        prismaClient: client,
        verifyDatabase: async () => ({ primaryAdminEmail: "admin@example.test" }),
      }),
      /order or payment history exists/
    );
    assert.equal(calls.length, 0);
  });

  it("deletes only CUSTOMER identities and preserves the trusted ADMIN invariants", async () => {
    const { client, calls } = cleanupMock();
    const output = [];
    const result = await cleanupProductionDummyCustomers({
      argumentsList: [PRODUCTION_CUSTOMER_CLEANUP_CONFIRMATION],
      environment: {},
      prismaClient: client,
      verifyDatabase: async () => ({ primaryAdminEmail: "admin@example.test" }),
      audit: (value) => output.push(value),
    });

    assert.equal(result.customersDeleted, 2);
    assert.equal(result.adminsAfter, 1);
    assert.equal(calls[1].where.role, "CUSTOMER");
    assert.doesNotMatch(output.join(""), /admin@example|customer-one|customer-two/);
  });
});
