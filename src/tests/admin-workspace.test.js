import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_LOGIN_ERROR,
  getAdminLoginDecision,
} from "../lib/auth/admin-login.js";
import {
  getAdminLoginPath,
  getSafeAdminRedirectPath,
} from "../lib/auth/redirects.js";

describe("dedicated admin login decisions", () => {
  it("allows only a trusted ADMIN and returns to the requested admin page", () => {
    assert.deepEqual(
      getAdminLoginDecision({
        user: { id: "admin" },
        role: "ADMIN",
        intendedPath: "/admin/reviews?status=PENDING",
      }),
      {
        allowed: true,
        clearSession: false,
        redirectTo: "/admin/reviews?status=PENDING",
      }
    );
  });

  it("rejects a valid CUSTOMER identity and requires its admin-login session to clear", () => {
    assert.deepEqual(
      getAdminLoginDecision({
        user: { id: "customer" },
        role: "CUSTOMER",
        intendedPath: "/admin",
      }),
      {
        allowed: false,
        clearSession: true,
        redirectTo: null,
      }
    );
  });

  it("fails closed when no trusted role row can be resolved", () => {
    assert.deepEqual(
      getAdminLoginDecision({
        user: { id: "unprovisioned" },
        role: null,
        intendedPath: "/admin",
      }),
      {
        allowed: false,
        clearSession: true,
        redirectTo: null,
      }
    );
    assert.match(ADMIN_LOGIN_ERROR, /Unable to sign in/);
  });
});

describe("admin redirect boundary", () => {
  it("accepts only local paths inside the admin workspace", () => {
    assert.equal(getSafeAdminRedirectPath("/admin/orders?page=2"), "/admin/orders?page=2");
    assert.equal(getSafeAdminRedirectPath("/account"), "/admin");
    assert.equal(getSafeAdminRedirectPath("https://attacker.example/admin"), "/admin");
    assert.equal(getSafeAdminRedirectPath("//attacker.example/admin"), "/admin");
  });

  it("builds one dedicated login URL without a redundant root next parameter", () => {
    assert.equal(getAdminLoginPath("/admin"), "/admin");
    assert.equal(
      getAdminLoginPath("/admin/payments"),
      "/admin?next=%2Fadmin%2Fpayments"
    );
    assert.equal(getAdminLoginPath("/menu"), "/admin");
  });
});
