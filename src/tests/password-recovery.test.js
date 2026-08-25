import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPasswordRecoveryProof,
  getPasswordRecoveryRedirectUrl,
  hasValidPasswordRecoveryProof,
} from "../lib/auth/password-recovery.js";
import { validateForgotPasswordPayload, validateResetPasswordPayload } from "../lib/validation/auth.js";

describe("password recovery redirect handling", () => {
  it("returns recovery links to the active local development origin", () => {
    assert.equal(
      getPasswordRecoveryRedirectUrl({
        requestUrl: "http://127.0.0.1:3100/api/auth/forgot-password",
        environment: "development",
        configuredSiteUrl: "http://localhost:3000",
      }),
      "http://127.0.0.1:3100/auth/callback?next=%2Freset-password"
    );
  });

  it("uses the configured HTTPS origin outside development", () => {
    assert.equal(
      getPasswordRecoveryRedirectUrl({
        requestUrl: "http://localhost:3000/api/auth/forgot-password",
        environment: "production",
        configuredSiteUrl: "https://kobbyskitchen.example/",
      }),
      "https://kobbyskitchen.example/auth/callback?next=%2Freset-password"
    );
  });

  it("fails closed when neither configured nor request origin is valid", () => {
    assert.throws(
      () =>
        getPasswordRecoveryRedirectUrl({
          requestUrl: "not-a-url",
          environment: "development",
          configuredSiteUrl: "not-a-url",
        }),
      { message: "invalid_password_recovery_redirect_origin" }
    );
  });
});

describe("password recovery proof", () => {
  it("accepts only an unexpired proof for the authenticated recovery user", () => {
    const now = 1_700_000_000_000;
    const proof = createPasswordRecoveryProof("customer-id", "server-secret", now);

    assert.equal(
      hasValidPasswordRecoveryProof(proof, "customer-id", "server-secret", now),
      true
    );
    assert.equal(
      hasValidPasswordRecoveryProof(proof, "another-user", "server-secret", now),
      false
    );
    assert.equal(
      hasValidPasswordRecoveryProof(`${proof}tampered`, "customer-id", "server-secret", now),
      false
    );
    assert.equal(
      hasValidPasswordRecoveryProof(proof, "customer-id", "server-secret", now + 901_000),
      false
    );
  });
});

describe("password recovery payload validation", () => {
  it("validates the recovery email without accepting malformed addresses", () => {
    assert.deepEqual(validateForgotPasswordPayload({ email: " ama@example.com " }).errors, {});
    assert.ok(validateForgotPasswordPayload({ email: "not-an-email" }).errors.email);
  });

  it("requires a secure matching password confirmation", () => {
    assert.deepEqual(
      validateResetPasswordPayload({
        password: "new-password-123",
        confirmPassword: "new-password-123",
      }).errors,
      {}
    );
    assert.equal(
      validateResetPasswordPayload({
        password: "new-password-123",
        confirmPassword: "different-password",
      }).errors.confirmPassword,
      "Passwords do not match."
    );
    assert.ok(
      validateResetPasswordPayload({
        password: "short",
        confirmPassword: "short",
      }).errors.password
    );
  });
});
