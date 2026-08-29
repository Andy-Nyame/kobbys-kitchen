import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getSafeRedirectPath } from "../lib/auth/redirects.js";
import { isOrderingEnabled } from "../lib/feature-flags.js";
import {
  sanitizeTextValue,
  validateForgotPasswordPayload,
  validateLoginPayload,
  validateProfileUpdatePayload,
  validateResetPasswordPayload,
  validateSignupPayload,
} from "../lib/validation/auth.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.join(testDirectory, "../..");
const originalOrderingFlag = process.env.V2_ORDERING_ENABLED;

afterEach(() => {
  if (originalOrderingFlag === undefined) {
    delete process.env.V2_ORDERING_ENABLED;
  } else {
    process.env.V2_ORDERING_ENABLED = originalOrderingFlag;
  }
});

describe("ordering feature flag", () => {
  it("defaults to disabled", () => {
    delete process.env.V2_ORDERING_ENABLED;
    assert.equal(isOrderingEnabled(), false);
  });

  it("enables ordering only for a true string", () => {
    for (const value of ["false", "1", "yes", " true ", ""]) {
      process.env.V2_ORDERING_ENABLED = value;
      assert.equal(isOrderingEnabled(), false, `expected ${JSON.stringify(value)} to be disabled`);
    }

    process.env.V2_ORDERING_ENABLED = "TRUE";
    assert.equal(isOrderingEnabled(), true);
  });
});

describe("safe auth redirects", () => {
  it("allows local absolute paths and query strings", () => {
    assert.equal(getSafeRedirectPath("/reset-password?from=email"), "/reset-password?from=email");
  });

  it("rejects external, protocol-relative, and backslash redirects", () => {
    for (const value of [
      "https://example.com/account",
      "//example.com/account",
      "/\\example.com/account",
      "account",
      null,
    ]) {
      assert.equal(getSafeRedirectPath(value), "/account");
    }
  });

  it("uses a caller-provided fallback", () => {
    assert.equal(getSafeRedirectPath("//example.com", "/login"), "/login");
  });
});

describe("auth payload validation", () => {
  const validSignup = {
    email: "customer@example.com",
    password: "password123",
    displayName: "Test Customer",
    phone: "+233555123456",
  };

  it("accepts and normalizes a valid signup", () => {
    const result = validateSignupPayload({
      ...validSignup,
      email: " customer@example.com ",
      displayName: " Test Customer ",
    });

    assert.deepEqual(result.errors, {});
    assert.equal(result.data.email, "customer@example.com");
    assert.equal(result.data.displayName, "Test Customer");
  });

  it("rejects each invalid signup field", () => {
    const cases = [
      [{ ...validSignup, email: "invalid" }, "email"],
      [{ ...validSignup, password: "short" }, "password"],
      [{ ...validSignup, displayName: "T" }, "displayName"],
      [{ ...validSignup, phone: "123" }, "phone"],
    ];

    for (const [payload, field] of cases) {
      assert.ok(validateSignupPayload(payload).errors[field]);
    }
  });

  it("does not accept a role from signup input", () => {
    const result = validateSignupPayload({ ...validSignup, role: "ADMIN" });
    assert.deepEqual(Object.keys(result.data).sort(), ["displayName", "email", "password", "phone"]);
  });

  it("removes control characters from text", () => {
    assert.equal(sanitizeTextValue(" Test\u0000 User\n"), "Test User");
  });

  it("validates login, recovery, reset, and profile payloads", () => {
    assert.ok(validateLoginPayload({ email: "bad", password: "" }).errors.email);
    assert.ok(validateLoginPayload({ email: "bad", password: "" }).errors.password);
    assert.ok(validateForgotPasswordPayload({ email: "bad" }).errors.email);
    assert.ok(validateResetPasswordPayload({ password: "short" }).errors.password);
    assert.ok(validateProfileUpdatePayload({ displayName: "T", phone: "1" }).errors.displayName);
    assert.ok(validateProfileUpdatePayload({ displayName: "T", phone: "1" }).errors.phone);
  });
});

describe("database stabilization contract", () => {
  const schema = fs.readFileSync(
    path.join(rootDirectory, "prisma/schema.prisma"),
    "utf8"
  );
  const constraints = fs.readFileSync(
    path.join(
      rootDirectory,
      "prisma/migrations/20260827140000_align_domain_constraints/migration.sql"
    ),
    "utf8"
  );
  const provisioning = fs.readFileSync(
    path.join(rootDirectory, "src/lib/auth/provisioning.js"),
    "utf8"
  );

  it("defaults and provisions public accounts as CUSTOMER only", () => {
    assert.match(schema, /role\s+AppRole\s+@default\(CUSTOMER\)/);
    assert.match(provisioning, /role:\s*"CUSTOMER"/);
    assert.doesNotMatch(provisioning, /role:\s*"ADMIN"/);
  });

  it("keeps customer order mutation closed through the authoritative server guard", () => {
    const orderRoute = fs.readFileSync(
      path.join(rootDirectory, "src/app/api/orders/route.js"),
      "utf8"
    );
    const orderingServer = fs.readFileSync(
      path.join(rootDirectory, "src/lib/ordering/server.js"),
      "utf8"
    );
    const orderServer = fs.readFileSync(
      path.join(rootDirectory, "src/lib/orders/server.js"),
      "utf8"
    );

    assert.match(orderRoute, /createPickupOrderForCustomer/);
    assert.match(orderServer, /assertOrderingOpenForSubmission/);
    assert.match(orderingServer, /isOrderingEnabled\(\)/);
    assert.match(orderingServer, /assertOrderingStateOpenForSubmission/);
  });

  it("adds nonnegative integer-minor-unit constraints", () => {
    assert.match(constraints, /"priceMinor" >= 0/);
    assert.match(constraints, /"subtotalMinor" >= 0/);
    assert.match(constraints, /"totalMinor" >= 0/);
  });
});
