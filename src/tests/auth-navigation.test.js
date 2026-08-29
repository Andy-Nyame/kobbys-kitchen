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
    assert.equal(navigation.accountMenu.navigationLabel, "Customer account");
    assert.equal(navigation.accountMenu.triggerLabel, "Open account menu");
    assert.deepEqual(navigation.accountMenu.links, [
      { label: "Profile", href: "/account/profile" },
      { label: "My Orders", href: "/account/orders" },
    ]);
  });

  it("shows a trusted ADMIN an admin-aware identity menu on public pages", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "admin", email: "admin@example.com", name: "Ama Admin" },
      "ADMIN",
      { display_name: "Ama Admin" }
    );

    assert.equal(navigation.accountMenu.displayName, "Ama Admin");
    assert.equal(navigation.accountMenu.email, "admin@example.com");
    assert.equal(
      navigation.accountMenu.triggerLabel,
      "Open administrator account menu"
    );
    assert.equal(
      navigation.accountMenu.navigationLabel,
      "Administrator account"
    );
    assert.deepEqual(navigation.accountMenu.links, [
      { label: "Admin Dashboard", href: "/admin" },
      { label: "Admin Profile", href: "/admin/profile" },
    ]);
  });

  it("does not expose ADMIN actions to a CUSTOMER", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "customer", email: "customer@example.com" },
      "CUSTOMER",
      { display_name: "Customer Name" }
    );

    assert.equal(
      navigation.accountMenu.links.some((link) => link.href.startsWith("/admin")),
      false
    );
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
