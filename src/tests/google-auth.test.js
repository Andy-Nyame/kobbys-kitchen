import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSafeCustomerRedirectPath,
  getSafeRedirectPath,
} from "../lib/auth/redirects.js";
import { getHeaderAuthNavigation } from "../lib/auth/header-navigation.js";

describe("Auth.js Google customer boundaries", () => {
  it("accepts only local customer destinations", () => {
    assert.equal(getSafeCustomerRedirectPath("/account/profile"), "/account/profile");
    assert.equal(getSafeCustomerRedirectPath("https://attacker.example"), "/account");
    assert.equal(getSafeCustomerRedirectPath("//attacker.example"), "/account");
    assert.equal(getSafeCustomerRedirectPath("/admin"), "/account");
  });

  it("preserves safe local callback paths without accepting external origins", () => {
    assert.equal(getSafeRedirectPath("/account?from=google"), "/account?from=google");
    assert.equal(getSafeRedirectPath("https://attacker.example", "/login"), "/login");
  });

  it("never exposes admin controls from provider presentation metadata", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "oauth-user", image: "https://images.example.test/user.png" },
      "ADMIN"
    );

    assert.equal(navigation.accountMenu, null);
    assert.deepEqual(navigation.links, []);
  });
});
