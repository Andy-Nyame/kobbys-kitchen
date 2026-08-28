import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import {
  PRODUCTION_ADMIN_CONFIRMATION,
  provisionPrimaryAdminProduction,
  validateProductionEnvironment,
  verifyProductionDatabase,
} from "../../scripts/production-admin-provisioning.js";

const primaryEmail = "admin@example.test";

function productionEnvironment(overrides = {}) {
  return {
    APP_ENV: "production",
    DATABASE_URL:
      "postgresql://owner:password@ep-production-pooler.example.neon.tech/neondb?sslmode=verify-full",
    DATABASE_URL_UNPOOLED:
      "postgresql://owner:password@ep-production.example.neon.tech/neondb?sslmode=verify-full",
    NEON_PROJECT_ID: "project-production",
    NEON_BRANCH_ID: "branch-production",
    NEON_DEVELOPMENT_BRANCH_ID: "branch-development",
    PRIMARY_ADMIN_EMAIL: primaryEmail,
    ...overrides,
  };
}

function verifiedConfiguration(environment) {
  return validateProductionEnvironment(environment);
}

function prismaDouble(users = [{ id: "user-1", role: "CUSTOMER" }]) {
  const calls = { findMany: [], update: [] };
  const client = {
    get account() {
      throw new Error("Account must not be accessed.");
    },
    get profile() {
      throw new Error("Profile must not be accessed.");
    },
    user: {
      async findMany(input) {
        calls.findMany.push(input);
        return users;
      },
      async update(input) {
        calls.update.push(input);
        return { role: "ADMIN" };
      },
    },
  };

  return { calls, client };
}

async function runProvisioning({
  environment = productionEnvironment(),
  users,
  audit = () => {},
} = {}) {
  const database = prismaDouble(users);
  const result = await provisionPrimaryAdminProduction({
    argumentsList: [PRODUCTION_ADMIN_CONFIRMATION],
    environment,
    prismaClient: database.client,
    verifyDatabase: async (receivedEnvironment) =>
      verifiedConfiguration(receivedEnvironment),
    audit,
  });

  return { ...database, result };
}

describe("Production primary-admin provisioning", () => {
  it("keeps Production credentials out of Next.js reserved environment files", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")
    );
    const command = packageJson.scripts["provision:primary-admin:production"];

    assert.match(command, /--env-file-if-exists=\.env\.admin-production\.local/);
    assert.doesNotMatch(command, /\.env\.production\.local/);
  });

  it("refuses non-Production environments", () => {
    assert.throws(
      () => validateProductionEnvironment(productionEnvironment({ APP_ENV: "development" })),
      /APP_ENV=production/
    );
  });

  it("refuses the Development branch as the expected target", () => {
    assert.throws(
      () =>
        validateProductionEnvironment(
          productionEnvironment({ NEON_BRANCH_ID: "branch-development" })
        ),
      /must differ from Development/
    );
  });

  it("refuses a database whose actual fingerprint is not Production", async () => {
    let ended = false;

    await assert.rejects(
      verifyProductionDatabase({
        environment: productionEnvironment(),
        createClient: () => ({
          async connect() {},
          async end() {
            ended = true;
          },
          async query() {
            return {
              rows: [{ project_id: "project-production", branch_id: "branch-other" }],
            };
          },
        }),
      }),
      /does not match Production/
    );
    assert.equal(ended, true);
  });

  it("explicitly refuses an actual Development branch", async () => {
    await assert.rejects(
      verifyProductionDatabase({
        environment: productionEnvironment(),
        createClient: () => ({
          async connect() {},
          async end() {},
          async query() {
            return {
              rows: [
                { project_id: "project-production", branch_id: "branch-development" },
              ],
            };
          },
        }),
      }),
      /Development branch/
    );
  });

  it("refuses a missing primary-admin environment identity", () => {
    assert.throws(
      () => validateProductionEnvironment(productionEnvironment({ PRIMARY_ADMIN_EMAIL: "" })),
      /PRIMARY_ADMIN_EMAIL is required/
    );
  });

  it("requires verify-full on both database URLs", () => {
    assert.throws(
      () =>
        validateProductionEnvironment(
          productionEnvironment({
            DATABASE_URL:
              "postgresql://owner:password@ep-production-pooler.example.neon.tech/neondb?sslmode=require",
          })
        ),
      /DATABASE_URL must use sslmode=verify-full/
    );
    assert.throws(
      () =>
        validateProductionEnvironment(
          productionEnvironment({
            DATABASE_URL_UNPOOLED:
              "postgresql://owner:password@ep-production.example.neon.tech/neondb?sslmode=require",
          })
        ),
      /DATABASE_URL_UNPOOLED must use sslmode=verify-full/
    );
  });

  it("requires the runtime URL to be pooled and the migration URL direct", () => {
    assert.throws(
      () =>
        validateProductionEnvironment(
          productionEnvironment({
            DATABASE_URL:
              "postgresql://owner:password@ep-production.example.neon.tech/neondb?sslmode=verify-full",
          })
        ),
      /DATABASE_URL must use the pooled Neon host/
    );
    assert.throws(
      () =>
        validateProductionEnvironment(
          productionEnvironment({
            DATABASE_URL_UNPOOLED:
              "postgresql://owner:password@ep-production-pooler.example.neon.tech/neondb?sslmode=verify-full",
          })
        ),
      /DATABASE_URL_UNPOOLED must use the direct Neon host/
    );
  });

  it("refuses a missing User", async () => {
    await assert.rejects(runProvisioning({ users: [] }), /does not exist/);
  });

  it("refuses a duplicated case-insensitive identity", async () => {
    await assert.rejects(
      runProvisioning({
        users: [
          { id: "user-1", role: "CUSTOMER" },
          { id: "user-2", role: "CUSTOMER" },
        ],
      }),
      /duplicated primary admin identity/
    );
  });

  it("refuses without the exact explicit confirmation flag", async () => {
    const database = prismaDouble();
    let verified = false;

    await assert.rejects(
      provisionPrimaryAdminProduction({
        argumentsList: [],
        environment: productionEnvironment(),
        prismaClient: database.client,
        verifyDatabase: async () => {
          verified = true;
        },
      }),
      /Refusing Production provisioning/
    );
    assert.equal(verified, false);
    assert.equal(database.calls.findMany.length, 0);
  });

  it("updates only the trusted User role and never accesses Profile or Account", async () => {
    const { calls, result } = await runProvisioning();

    assert.deepEqual(calls.findMany, [
      {
        where: { email: { equals: primaryEmail, mode: "insensitive" } },
        select: { id: true, role: true },
        take: 2,
      },
    ]);
    assert.deepEqual(calls.update, [
      {
        where: { id: "user-1" },
        data: { role: "ADMIN" },
        select: { role: true },
      },
    ]);
    assert.deepEqual(result, { status: "provisioned", role: "ADMIN" });
  });

  it("is idempotent when the User is already ADMIN", async () => {
    const { calls, result } = await runProvisioning({
      users: [{ id: "user-1", role: "ADMIN" }],
    });

    assert.equal(calls.update.length, 0);
    assert.deepEqual(result, { status: "already_admin", role: "ADMIN" });
  });

  it("emits minimal audit output without identity or credentials", async () => {
    const output = [];
    const environment = productionEnvironment();

    await runProvisioning({ environment, audit: (message) => output.push(message) });

    assert.deepEqual(output, [
      JSON.stringify({ ok: true, status: "provisioned", role: "ADMIN" }),
    ]);
    assert.doesNotMatch(output.join("\n"), /admin@example\.test|password|branch-production/);
  });
});
