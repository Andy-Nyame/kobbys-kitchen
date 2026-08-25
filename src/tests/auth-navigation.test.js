import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getHeaderAuthNavigation } from "../lib/auth/header-navigation.js";
import {
  assertDevelopmentAdminBootstrap,
  normalizePrimaryAdminEmail,
  provisionPrimaryAdmin,
} from "../lib/auth/primary-admin.js";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.join(testsDirectory, "../..");

describe("shared desktop and mobile auth navigation policy", () => {
  it("shows one Login entry when signed out", () => {
    assert.deepEqual(getHeaderAuthNavigation(null, null), {
      links: [{ label: "Login", href: "/login" }],
      accountMenu: null,
      showSignOut: false,
    });
  });

  it("shows a focused account menu to customers without public admin actions", () => {
    assert.deepEqual(getHeaderAuthNavigation(
      { id: "customer" },
      "CUSTOMER",
      { display_name: "Ama Mensah" }
    ), {
      links: [],
      accountMenu: {
        displayName: "Ama Mensah",
        email: "",
        avatar: { imageUrl: null, initials: "AM" },
        links: [
          { label: "Profile", href: "/account/profile" },
          { label: "My Orders", href: "/account/orders" },
        ],
      },
      showSignOut: false,
    });
  });

  it("keeps administration undiscoverable in the public header", () => {
    assert.deepEqual(getHeaderAuthNavigation({ id: "admin" }, "ADMIN"), {
      links: [],
      accountMenu: null,
      showSignOut: false,
    });
  });

  it("fails closed for an authenticated identity with no trusted role", () => {
    assert.deepEqual(getHeaderAuthNavigation({ id: "unprovisioned" }, null), {
      links: [],
      accountMenu: null,
      showSignOut: true,
    });
  });

  it("keeps customer menu links limited to direct customer destinations", () => {
    const navigation = getHeaderAuthNavigation(
      { id: "customer" },
      "CUSTOMER",
      { display_name: "Ama Mensah" }
    );

    assert.deepEqual(navigation.accountMenu.links, [
      { label: "Profile", href: "/account/profile" },
      { label: "My Orders", href: "/account/orders" },
    ]);
  });

  it("keeps provider-specific presentation separate from customer navigation", () => {
    const passwordCustomer = getHeaderAuthNavigation(
      { id: "password-customer", email: "ama@example.com" },
      "CUSTOMER",
      { display_name: "Ama Mensah" }
    );
    const googleCustomer = getHeaderAuthNavigation(
      {
        id: "google-customer",
        email: "ama.google@example.com",
        identities: [
          {
            provider: "google",
            identity_data: { picture: "https://images.example.test/ama.png" },
          },
        ],
      },
      "CUSTOMER",
      { display_name: "Ama Mensah" }
    );

    assert.deepEqual(passwordCustomer.accountMenu.links, googleCustomer.accountMenu.links);
    assert.equal(passwordCustomer.accountMenu.avatar.initials, "AM");
    assert.equal(
      googleCustomer.accountMenu.avatar.imageUrl,
      "https://images.example.test/ama.png"
    );
  });
});

describe("primary admin bootstrap domain", () => {
  it("refuses to run outside the explicit development environment", () => {
    assert.doesNotThrow(() => assertDevelopmentAdminBootstrap("development"));
    assert.throws(
      () => assertDevelopmentAdminBootstrap("production"),
      { code: "unsafe_admin_bootstrap_environment" }
    );
  });

  it("normalizes the trusted email and rejects invalid values", () => {
    assert.equal(
      normalizePrimaryAdminEmail(" Owner@Example.com "),
      "owner@example.com"
    );
    assert.equal(normalizePrimaryAdminEmail("not-an-email"), "");
  });

  it("fails when the existing Supabase Auth user cannot be found", async () => {
    let assignmentCalled = false;

    await assert.rejects(
      provisionPrimaryAdmin({
        email: "owner@example.com",
        loadAuthUsersPage: async () => ({ users: [], error: null }),
        assignAdminRole: async () => {
          assignmentCalled = true;
          return { error: null };
        },
      }),
      { code: "auth_user_not_found" }
    );

    assert.equal(assignmentCalled, false);
  });

  it("idempotently assigns ADMIN to the matched existing auth user", async () => {
    const roles = new Map();
    const loadAuthUsersPage = async () => ({
      users: [{ id: "owner-id", email: "owner@example.com" }],
      error: null,
    });
    const assignAdminRole = async (assignment) => {
      roles.set(assignment.user_id, assignment);
      return { error: null };
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await provisionPrimaryAdmin({
        email: "OWNER@example.com",
        loadAuthUsersPage,
        assignAdminRole,
      });

      assert.equal(result.role, "ADMIN");
      assert.equal(result.userId, "owner-id");
    }

    assert.equal(roles.size, 1);
    assert.deepEqual(roles.get("owner-id"), {
      user_id: "owner-id",
      role: "ADMIN",
      granted_by: "owner-id",
    });
  });

  it("reports a missing user_roles migration precisely", async () => {
    await assert.rejects(
      provisionPrimaryAdmin({
        email: "owner@example.com",
        loadAuthUsersPage: async () => ({
          users: [{ id: "owner-id", email: "owner@example.com" }],
          error: null,
        }),
        inspectRoleStorage: async () => ({ error: { code: "PGRST205" } }),
        assignAdminRole: async () => {
          assert.fail("assignment must not run when role storage is missing");
        },
      }),
      {
        code: "admin_role_storage_missing",
        message:
          "public.user_roles is unavailable. Apply the V2 role migrations to a confirmed safe environment first.",
      }
    );
  });

  it("has no public application bootstrap route", () => {
    for (const routePath of [
      "src/app/api/admin/bootstrap/route.js",
      "src/app/api/auth/admin/route.js",
      "src/app/api/auth/bootstrap/route.js",
    ]) {
      assert.equal(fs.existsSync(path.join(rootDirectory, routePath)), false);
    }
  });
});
