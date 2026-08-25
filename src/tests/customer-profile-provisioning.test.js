import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getCustomerProfileProvisioningDecision } from "../lib/auth/customer-profile-provisioning.js";

describe("universal customer profile provisioning policy", () => {
  it("requires the same repair path for password and OAuth customer identities", () => {
    const passwordUser = { id: "password-customer", email: "ama@example.com" };
    const oauthUser = {
      id: "oauth-customer",
      email: "ama.google@example.com",
      identities: [{ provider: "google" }],
    };

    assert.equal(
      getCustomerProfileProvisioningDecision({
        user: passwordUser,
        role: "CUSTOMER",
        profile: null,
      }),
      "repair"
    );
    assert.equal(
      getCustomerProfileProvisioningDecision({
        user: oauthUser,
        role: "CUSTOMER",
        profile: null,
      }),
      "repair"
    );
  });

  it("does not provision a non-customer or unauthenticated identity", () => {
    assert.equal(
      getCustomerProfileProvisioningDecision({
        user: { id: "admin" },
        role: "ADMIN",
        profile: null,
      }),
      "not_customer"
    );
    assert.equal(
      getCustomerProfileProvisioningDecision({
        user: null,
        role: null,
        profile: null,
      }),
      "unavailable"
    );
  });

  it("does not repeat provisioning after a profile exists", () => {
    assert.equal(
      getCustomerProfileProvisioningDecision({
        user: { id: "customer" },
        role: "CUSTOMER",
        profile: { display_name: "Ama", phone: null },
      }),
      "existing"
    );
  });
});
