import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getGoogleOAuthCallbackUrl } from "../lib/auth/google-oauth.js";
import { getHeaderAuthNavigation } from "../lib/auth/header-navigation.js";
import { validateSignupPayload } from "../lib/validation/auth.js";

describe("Google customer OAuth boundaries", () => {
  it("returns OAuth callbacks only to local customer destinations", () => {
    assert.equal(
      getGoogleOAuthCallbackUrl(
        "http://localhost:3000/api/auth/google",
        "/account/profile"
      ),
      "http://localhost:3000/auth/callback?flow=oauth&next=%2Faccount%2Fprofile"
    );
    assert.equal(
      getGoogleOAuthCallbackUrl(
        "http://localhost:3000/api/auth/google",
        "https://attacker.example"
      ),
      "http://localhost:3000/auth/callback?flow=oauth&next=%2Faccount"
    );
    assert.equal(
      getGoogleOAuthCallbackUrl(
        "http://localhost:3000/api/auth/google",
        "/admin"
      ),
      "http://localhost:3000/auth/callback?flow=oauth&next=%2Faccount"
    );
  });

  it("does not expose public admin controls after any authenticated role lookup", () => {
    const adminNavigation = getHeaderAuthNavigation({ id: "admin" }, "ADMIN");

    assert.equal(adminNavigation.accountMenu, null);
    assert.deepEqual(adminNavigation.links, []);
  });

  it("keeps email/password signup phone validation strict", () => {
    const result = validateSignupPayload({
      displayName: "Ama Customer",
      email: "ama@example.com",
      password: "secure-password",
      phone: "",
    });

    assert.ok(result.errors.phone);
  });
});
