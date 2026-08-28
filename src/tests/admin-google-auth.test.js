import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getAdminLoginDecision } from "../lib/auth/admin-login.js";
import { getGoogleAuthStartDecision } from "../lib/auth/redirects.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.join(testDirectory, "../..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDirectory, relativePath), "utf8");
}

describe("dedicated admin Google authentication", () => {
  it("preserves only safe admin return paths", () => {
    assert.deepEqual(
      getGoogleAuthStartDecision({
        intent: "admin",
        intendedPath: "/admin/reviews?status=PENDING",
      }),
      {
        intent: "admin",
        redirectTo: "/admin/reviews?status=PENDING",
        errorPath: "/admin?error=oauth_unavailable",
      }
    );

    for (const intendedPath of [
      "https://attacker.example/admin",
      "//attacker.example/admin",
      "javascript:alert(1)",
      "/account",
    ]) {
      assert.equal(
        getGoogleAuthStartDecision({ intent: "admin", intendedPath }).redirectTo,
        "/admin"
      );
    }
  });

  it("keeps customer Google authentication on the customer boundary", () => {
    assert.deepEqual(
      getGoogleAuthStartDecision({
        intent: "customer",
        intendedPath: "/account/profile",
      }),
      {
        intent: "customer",
        redirectTo: "/account/profile",
        errorPath: "/login?error=oauth_unavailable",
      }
    );
  });

  it("authorizes Google identities from the trusted database role only", () => {
    const googleIdentity = {
      id: "google-user",
      email: "admin-looking@example.com",
      providerMetadata: { role: "ADMIN", hostedDomain: "example.com" },
    };

    assert.equal(
      getAdminLoginDecision({
        user: googleIdentity,
        role: "CUSTOMER",
        intendedPath: "/admin",
      }).allowed,
      false
    );
    assert.equal(
      getAdminLoginDecision({
        user: googleIdentity,
        role: null,
        intendedPath: "/admin",
      }).allowed,
      false
    );
    assert.equal(
      getAdminLoginDecision({
        user: googleIdentity,
        role: "ADMIN",
        intendedPath: "/admin",
      }).allowed,
      true
    );
  });

  it("renders Google beside credentials in the dedicated admin login", () => {
    const formSource = readProjectFile("src/components/admin/AdminLoginForm.jsx");
    const googleRouteSource = readProjectFile("src/app/api/auth/google/route.js");
    const credentialsRouteSource = readProjectFile(
      "src/app/api/auth/admin-login/route.js"
    );

    assert.match(formSource, /GoogleAuthButton intent="admin"/);
    assert.match(formSource, /Continue with Google|GoogleAuthButton/);
    assert.match(googleRouteSource, /signIn\("google"/);
    assert.match(credentialsRouteSource, /authenticateCredentials/);
    assert.match(credentialsRouteSource, /role: "ADMIN"/);
  });

  it("keeps one Auth.js user and one provider identity relation", () => {
    const schema = readProjectFile("prisma/schema.prisma");

    assert.match(schema, /email\s+String\?\s+@unique/);
    assert.match(schema, /@@unique\(\[provider, providerAccountId\]\)/);
    assert.match(schema, /role\s+AppRole\s+@default\(CUSTOMER\)/);
  });

  it("contains no email or provider-metadata ADMIN inference", () => {
    const implementation = [
      readProjectFile("src/auth.js"),
      readProjectFile("src/app/api/auth/google/route.js"),
      readProjectFile("src/lib/auth/provisioning.js"),
    ].join("\n");

    assert.doesNotMatch(implementation, /nyameandy8/i);
    assert.doesNotMatch(implementation, /email\s*===.*ADMIN/i);
    assert.doesNotMatch(implementation, /metadata.*ADMIN/i);
  });
});
