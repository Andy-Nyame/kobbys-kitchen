import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  PRODUCTION_CHEF_CONFIRMATION,
  provisionPrimaryChefProduction,
  requireProductionChefConfirmation,
} from "../../scripts/production-chef-provisioning.js";

function environment(overrides = {}) {
  return { PRIMARY_CHEF_EMAIL: "chef@example.test", PRIMARY_ADMIN_EMAIL: "admin@example.test", ...overrides };
}

function prismaDouble(users = [{ id: "chef-1", role: "CUSTOMER" }]) {
  const calls = [];
  return {
    calls,
    client: {
      user: {
        findMany: async () => users,
        update: async (input) => { calls.push(input); return { role: input.data.role }; },
      },
    },
  };
}

const verified = async (env) => ({ primaryAdminEmail: env.PRIMARY_ADMIN_EMAIL.toLowerCase() });

describe("trusted CHEF provisioning", () => {
  it("requires explicit Production confirmation and a configured distinct trusted email", async () => {
    assert.throws(() => requireProductionChefConfirmation([]), /Refusing Production CHEF/);
    assert.doesNotThrow(() => requireProductionChefConfirmation([PRODUCTION_CHEF_CONFIRMATION]));
    const { client } = prismaDouble();
    await assert.rejects(provisionPrimaryChefProduction({ argumentsList: [PRODUCTION_CHEF_CONFIRMATION], environment: environment({ PRIMARY_CHEF_EMAIL: "" }), prismaClient: client, verifyDatabase: verified }), /PRIMARY_CHEF_EMAIL/);
    await assert.rejects(provisionPrimaryChefProduction({ argumentsList: [PRODUCTION_CHEF_CONFIRMATION], environment: environment({ PRIMARY_CHEF_EMAIL: "admin@example.test" }), prismaClient: client, verifyDatabase: verified }), /must not match/);
  });

  it("requires exactly one existing identity, refuses ADMIN demotion, and updates only role", async () => {
    for (const users of [[], [{ id: "1", role: "CUSTOMER" }, { id: "2", role: "CUSTOMER" }]]) {
      const { client } = prismaDouble(users);
      await assert.rejects(provisionPrimaryChefProduction({ argumentsList: [PRODUCTION_CHEF_CONFIRMATION], environment: environment(), prismaClient: client, verifyDatabase: verified }), /does not exist|duplicated/);
    }
    const admin = prismaDouble([{ id: "admin-1", role: "ADMIN" }]);
    await assert.rejects(provisionPrimaryChefProduction({ argumentsList: [PRODUCTION_CHEF_CONFIRMATION], environment: environment(), prismaClient: admin.client, verifyDatabase: verified }), /replace an ADMIN/);
    const customer = prismaDouble();
    const result = await provisionPrimaryChefProduction({ argumentsList: [PRODUCTION_CHEF_CONFIRMATION], environment: environment(), prismaClient: customer.client, verifyDatabase: verified, audit: () => {} });
    assert.equal(result.role, "CHEF");
    assert.deepEqual(customer.calls[0].data, { role: "CHEF" });
  });

  it("is idempotent and retains strict branch/SSL verification in the shared Production verifier", async () => {
    const chef = prismaDouble([{ id: "chef-1", role: "CHEF" }]);
    const result = await provisionPrimaryChefProduction({ argumentsList: [PRODUCTION_CHEF_CONFIRMATION], environment: environment(), prismaClient: chef.client, verifyDatabase: verified, audit: () => {} });
    assert.equal(result.status, "already_chef");
    assert.equal(chef.calls.length, 0);
    const [chefSource, adminSafety] = await Promise.all([
      readFile(new URL("../../scripts/production-chef-provisioning.js", import.meta.url), "utf8"),
      readFile(new URL("../../scripts/production-admin-provisioning.js", import.meta.url), "utf8"),
    ]);
    assert.match(chefSource, /verifyProductionDatabase/);
    assert.match(adminSafety, /APP_ENV !== "production"/);
    assert.match(adminSafety, /sslmode.*verify-full/);
    assert.match(adminSafety, /Development branch/);
  });
});
