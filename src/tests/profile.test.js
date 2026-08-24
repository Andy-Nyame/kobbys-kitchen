import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCustomerProfileUpdateAuthorization,
  prepareCustomerProfileUpdate,
} from "../lib/account/profile-update.js";
import {
  normalizeDisplayName,
  normalizeGhanaPhone,
  validateProfileUpdatePayload,
  validateSignupPayload,
} from "../lib/validation/auth.js";

const customer = { id: "customer-user-id", email: "customer@example.com" };
const validPayload = {
  displayName: "Kobby Customer",
  phone: "020 123 4567",
};

describe("customer profile validation", () => {
  it("normalizes display names and supported Ghana phone formats", () => {
    assert.equal(normalizeDisplayName("  Ama   Mensah  "), "Ama Mensah");

    for (const phone of [
      "020 123 4567",
      "020-123-4567",
      "+233 20 123 4567",
      "+233 (0)20 123 4567",
      "233201234567",
      "201234567",
    ]) {
      assert.equal(normalizeGhanaPhone(phone), "+233201234567");
    }
  });

  it("rejects malformed or non-Ghana phone values", () => {
    for (const phone of [
      "123",
      "+1 202 555 0123",
      "020-CALL-NOW",
      "+233 20 123 45678",
      "020 123\u00004567",
    ]) {
      assert.ok(validateProfileUpdatePayload({ ...validPayload, phone }).errors.phone);
    }
  });

  it("rejects malformed display names and control characters", () => {
    for (const displayName of ["A", "12345", "Ama\nMensah", "\u0000Kobby"]) {
      assert.ok(
        validateProfileUpdatePayload({ ...validPayload, displayName }).errors.displayName
      );
    }
  });

  it("uses the same canonical profile values at signup", () => {
    const result = validateSignupPayload({
      email: "customer@example.com",
      password: "password123",
      displayName: "  Ama   Mensah ",
      phone: "024 000 1234",
    });

    assert.deepEqual(result.errors, {});
    assert.equal(result.data.displayName, "Ama Mensah");
    assert.equal(result.data.phone, "+233240001234");
  });
});

describe("customer profile update authorization", () => {
  it("rejects unauthenticated and non-customer callers", () => {
    assert.equal(getCustomerProfileUpdateAuthorization(null, null).status, 401);
    assert.equal(getCustomerProfileUpdateAuthorization(customer, "ADMIN").status, 403);
    assert.equal(getCustomerProfileUpdateAuthorization(customer, null).status, 403);
  });

  it("permits authenticated customers", () => {
    assert.deepEqual(getCustomerProfileUpdateAuthorization(customer, "CUSTOMER"), {
      ok: true,
      status: 200,
    });
  });
});

describe("safe profile update preparation", () => {
  it("derives ownership from the authenticated identity and emits approved columns", () => {
    const result = prepareCustomerProfileUpdate({
      user: customer,
      role: "CUSTOMER",
      payload: validPayload,
    });

    assert.equal(result.ok, true);
    assert.equal(result.targetUserId, customer.id);
    assert.deepEqual(result.values, {
      display_name: "Kobby Customer",
      phone: "+233201234567",
    });
  });

  it("rejects identity, email, role, and other forbidden fields", () => {
    for (const forbidden of [
      { userId: "another-user-id" },
      { user_id: "another-user-id" },
      { email: "replacement@example.com" },
      { role: "ADMIN" },
      { created_at: "2026-01-01" },
    ]) {
      const result = prepareCustomerProfileUpdate({
        user: customer,
        role: "CUSTOMER",
        payload: { ...validPayload, ...forbidden },
      });

      assert.equal(result.ok, false);
      assert.equal(result.status, 400);
    }
  });

  it("fails before accepting a cross-user target from an unauthorized caller", () => {
    const result = prepareCustomerProfileUpdate({
      user: { id: "another-user-id" },
      role: "ADMIN",
      payload: { ...validPayload, userId: customer.id },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("returns field errors for invalid approved values", () => {
    const result = prepareCustomerProfileUpdate({
      user: customer,
      role: "CUSTOMER",
      payload: { displayName: "X", phone: "invalid" },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.ok(result.errors.displayName);
    assert.ok(result.errors.phone);
  });
});
