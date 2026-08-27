import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} from "../lib/validation/auth.js";
import { canUsePasswordRecovery } from "../lib/auth/password-recovery-policy.js";

describe("Auth.js password recovery payload boundaries", () => {
  it("validates the recovery email without accepting malformed addresses", () => {
    assert.deepEqual(
      validateForgotPasswordPayload({ email: " ama@example.com " }).errors,
      {}
    );
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
  });

  it("lets migrated credential-only users establish a new password", () => {
    assert.equal(
      canUsePasswordRecovery({
        id: "credential-user",
        email: "customer@example.com",
        passwordHash: null,
        accounts: [],
      }),
      true
    );
  });

  it("does not present password recovery to a Google-only identity", () => {
    assert.equal(
      canUsePasswordRecovery({
        id: "google-user",
        email: "google@example.com",
        passwordHash: null,
        accounts: [{ type: "oauth" }],
      }),
      false
    );
  });
});
