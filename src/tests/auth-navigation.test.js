import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAdminAuthorization } from "../lib/auth/authorization.js";
import { getHeaderAuthNavigation } from "../lib/auth/header-navigation.js";

describe("Auth.js role-aware navigation policy", () => {
  it("shows one Login entry when signed out", () => {
    assert.deepEqual(getHeaderAuthNavigation(null, null), {
      links: [{ label: "Login", href: "/login" }],
      accountMenu: null,
      showSignOut: false,
    });
  });

  it("shows the shared customer account menu for provider-independent users", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "customer", email: "ama@example.com", name: "Ama Mensah" },
      "CUSTOMER",
      { displayName: "Ama Mensah" }
    );

    assert.equal(navigation.accountMenu.displayName, "Ama Mensah");
    assert.equal(navigation.accountMenu.email, "ama@example.com");
    assert.deepEqual(navigation.accountMenu.links, [
      { label: "Profile", href: "/account/profile" },
      { label: "My Orders", href: "/account/orders" },
    ]);
  });

  it("keeps administration undiscoverable in the public header", () => {
    assert.deepEqual(getHeaderAuthNavigation({ id: "admin" }, "ADMIN"), {
      links: [],
      accountMenu: null,
      showSignOut: false,
    });
  });

  it("denies CUSTOMER and allows ADMIN on server-side admin policy", () => {
    assert.equal(
      getAdminAuthorization({ id: "customer" }, "CUSTOMER").allowed,
      false
    );
    assert.equal(
      getAdminAuthorization({ id: "admin" }, "ADMIN").allowed,
      true
    );
  });
});
