import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accountNavigation } from "../data/navigation.js";
import { getHeaderAuthNavigation } from "../lib/auth/header-navigation.js";
import {
  getCustomerLoginPath,
  getSafeCustomerRedirectPath,
} from "../lib/auth/redirects.js";

describe("customer account navigation", () => {
  it("keeps profile and order history one step from the public header", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "customer" },
      "CUSTOMER",
      { display_name: "Akua" }
    );

    assert.equal(navigation.accountMenu.label, "My Account");
    assert.equal(navigation.accountMenu.displayName, "Akua");
    assert.ok(
      navigation.accountMenu.links.some(
        (link) => link.href === "/account/profile" && link.label === "Profile"
      )
    );
    assert.ok(
      navigation.accountMenu.links.some(
        (link) => link.href === "/account/orders" && link.label === "My Orders"
      )
    );
  });

  it("provides the same core destinations in the account shell", () => {
    assert.deepEqual(accountNavigation, [
      { href: "/account", label: "Overview" },
      { href: "/account/profile", label: "Profile" },
      { href: "/account/orders", label: "My Orders" },
    ]);
  });

  it("falls back to a safe generic customer identity when profile loading fails", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "customer" },
      "CUSTOMER"
    );

    assert.equal(navigation.accountMenu.displayName, "Customer");
  });
});

describe("customer login return boundary", () => {
  it("allows only local customer account destinations", () => {
    assert.equal(
      getSafeCustomerRedirectPath("/account/profile?section=contact"),
      "/account/profile?section=contact"
    );
    assert.equal(getSafeCustomerRedirectPath("/admin"), "/account");
    assert.equal(getSafeCustomerRedirectPath("/menu"), "/account");
    assert.equal(
      getSafeCustomerRedirectPath("https://attacker.example/account"),
      "/account"
    );
  });

  it("builds login URLs that preserve protected account destinations", () => {
    assert.equal(getCustomerLoginPath("/account"), "/login");
    assert.equal(
      getCustomerLoginPath("/account/profile"),
      "/login?next=%2Faccount%2Fprofile"
    );
    assert.equal(getCustomerLoginPath("/admin"), "/login");
  });
});
