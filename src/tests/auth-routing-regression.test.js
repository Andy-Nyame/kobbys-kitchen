import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { getAdminAuthorization } from "../lib/auth/authorization.js";
import {
  getGoogleAuthStartDecision,
  getSafeRedirectPath,
} from "../lib/auth/redirects.js";
import { getAuthSignInPolicy } from "../lib/auth/sign-in-policy.js";

describe("customer/admin authentication routing regression", () => {
  it("allows first-time Google lifecycle without granting an authorization role", () => {
    assert.deepEqual(
      getAuthSignInPolicy({ provider: "google", userId: "new-user", databaseUser: null }),
      { allowed: true, provisionCustomer: false }
    );
    assert.deepEqual(
      getAuthSignInPolicy({ provider: "credentials", userId: "unknown", databaseUser: null }),
      { allowed: false, provisionCustomer: false }
    );
  });

  it("provisions only an existing trusted CUSTOMER and preserves ADMIN", () => {
    assert.equal(
      getAuthSignInPolicy({ provider: "google", userId: "customer", databaseUser: { role: "CUSTOMER" } }).provisionCustomer,
      true
    );
    assert.equal(
      getAuthSignInPolicy({ provider: "google", userId: "admin", databaseUser: { role: "ADMIN" } }).provisionCustomer,
      false
    );
  });

  it("separates safe customer and admin intent and rejects external redirects", () => {
    assert.equal(getGoogleAuthStartDecision({}).redirectTo, "/account");
    assert.equal(
      getGoogleAuthStartDecision({ intent: "admin", intendedPath: "/admin/menu" }).redirectTo,
      "/admin/menu"
    );
    assert.equal(
      getGoogleAuthStartDecision({ intent: "admin", intendedPath: "https://evil.example" }).redirectTo,
      "/admin"
    );
    assert.equal(getSafeRedirectPath("//evil.example", "/account"), "/account");
  });

  it("routes an authenticated CUSTOMER to an app-owned admin denial page", () => {
    const decision = getAdminAuthorization({ id: "customer" }, "CUSTOMER");
    assert.equal(decision.allowed, false);
    assert.equal(decision.redirectTo, "/access-denied?area=admin");
  });

  it("keeps public marketing layouts free of ADMIN redirects", async () => {
    const marketingLayout = await readFile("src/app/(marketing)/layout.js", "utf8");
    const siteHeader = await readFile("src/components/layout/SiteHeader.jsx", "utf8");
    assert.doesNotMatch(marketingLayout, /redirect\(/);
    assert.doesNotMatch(siteHeader, /redirect\(["']\/admin/);
  });
});
