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

  it("uses the trusted role, rather than provider presentation metadata, for admin actions", () => {
    const navigation = getHeaderAuthNavigation(
      {
        id: "oauth-user",
        image: "https://images.example.test/user.png",
        user_metadata: { role: "ADMIN" },
      },
      "CUSTOMER"
    );

    assert.equal(
      navigation.accountMenu.links.some((link) => link.href.startsWith("/admin")),
      false
    );
    assert.equal(
      navigation.accountMenu.avatar.imageUrl,
      "https://images.example.test/user.png"
    );
  });
});
