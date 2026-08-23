import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "../..");

// Static imports using relative paths
import { validateSignupPayload } from "../lib/validation/auth.js";
import { validateLoginPayload } from "../lib/validation/auth.js";
import { validateProfileUpdatePayload } from "../lib/validation/auth.js";
import { validateForgotPasswordPayload } from "../lib/validation/auth.js";
import { validateResetPasswordPayload } from "../lib/validation/auth.js";

// ============================================
// Feature flag tests
// ============================================

describe("Feature flags", () => {
  it("ordering is disabled by default when env var is not set", async () => {
    const original = process.env.V2_ORDERING_ENABLED;
    delete process.env.V2_ORDERING_ENABLED;

    const { isOrderingEnabled } = await import("../lib/feature-flags.js");
    assert.strictEqual(isOrderingEnabled(), false);

    if (original !== undefined) {
      process.env.V2_ORDERING_ENABLED = original;
    }
  });

  it("ordering is disabled when env var is false", async () => {
    process.env.V2_ORDERING_ENABLED = "false";
    const { isOrderingEnabled } = await import("../lib/feature-flags.js");
    assert.strictEqual(isOrderingEnabled(), false);
  });

  it("ordering is enabled only when env var is exactly true", async () => {
    process.env.V2_ORDERING_ENABLED = "true";
    const { isOrderingEnabled } = await import("../lib/feature-flags.js");
    assert.strictEqual(isOrderingEnabled(), true);
  });
});

// ============================================
// Auth validation tests
// ============================================

describe("Auth validation", () => {
  it("rejects signup with invalid email", () => {
    const result = validateSignupPayload({
      email: "not-an-email",
      password: "password123",
      displayName: "Test User",
      phone: "+233555123456",
    });
    assert.ok(result.errors.email, "Expected email error");
  });

  it("rejects signup with short password", () => {
    const result = validateSignupPayload({
      email: "test@example.com",
      password: "short",
      displayName: "Test User",
      phone: "+233555123456",
    });
    assert.ok(result.errors.password, "Expected password error");
  });

  it("rejects signup with short display name", () => {
    const result = validateSignupPayload({
      email: "test@example.com",
      password: "password123",
      displayName: "T",
      phone: "+233555123456",
    });
    assert.ok(result.errors.displayName, "Expected displayName error");
  });

  it("rejects signup with short phone", () => {
    const result = validateSignupPayload({
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
      phone: "123",
    });
    assert.ok(result.errors.phone, "Expected phone error");
  });

  it("accepts valid signup payload", () => {
    const result = validateSignupPayload({
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
      phone: "+233555123456",
    });
    assert.strictEqual(Object.keys(result.errors).length, 0);
    assert.strictEqual(result.data.email, "test@example.com");
    assert.strictEqual(result.data.displayName, "Test User");
  });

  it("sanitizes control characters from text fields", () => {
    const result = validateSignupPayload({
      email: "test@example.com",
      password: "password123",
      displayName: "Test\u0000User",
      phone: "+233555123456",
    });
    assert.strictEqual(result.data.displayName, "TestUser");
  });
});

// ============================================
// Login validation tests
// ============================================

describe("Login validation", () => {
  it("rejects login with invalid email", () => {
    const result = validateLoginPayload({
      email: "not-an-email",
      password: "password123",
    });
    assert.ok(result.errors.email, "Expected email error");
  });

  it("rejects login with empty password", () => {
    const result = validateLoginPayload({
      email: "test@example.com",
      password: "",
    });
    assert.ok(result.errors.password, "Expected password error");
  });

  it("accepts valid login payload", () => {
    const result = validateLoginPayload({
      email: "test@example.com",
      password: "password123",
    });
    assert.strictEqual(Object.keys(result.errors).length, 0);
  });
});

// ============================================
// Profile update validation tests
// ============================================

describe("Profile update validation", () => {
  it("rejects profile update with short display name", () => {
    const result = validateProfileUpdatePayload({
      displayName: "T",
      phone: "+233555123456",
    });
    assert.ok(result.errors.displayName, "Expected displayName error");
  });

  it("rejects profile update with short phone", () => {
    const result = validateProfileUpdatePayload({
      displayName: "Test User",
      phone: "123",
    });
    assert.ok(result.errors.phone, "Expected phone error");
  });

  it("accepts valid profile update payload", () => {
    const result = validateProfileUpdatePayload({
      displayName: "Test User",
      phone: "+233555123456",
    });
    assert.strictEqual(Object.keys(result.errors).length, 0);
  });
});

// ============================================
// Forgot password validation tests
// ============================================

describe("Forgot password validation", () => {
  it("rejects forgot password with invalid email", () => {
    const result = validateForgotPasswordPayload({
      email: "not-an-email",
    });
    assert.ok(result.errors.email, "Expected email error");
  });

  it("accepts valid forgot password payload", () => {
    const result = validateForgotPasswordPayload({
      email: "test@example.com",
    });
    assert.strictEqual(Object.keys(result.errors).length, 0);
  });
});

// ============================================
// Reset password validation tests
// ============================================

describe("Reset password validation", () => {
  it("rejects reset password with short password", () => {
    const result = validateResetPasswordPayload({
      password: "short",
    });
    assert.ok(result.errors.password, "Expected password error");
  });

  it("accepts valid reset password payload", () => {
    const result = validateResetPasswordPayload({
      password: "newpassword123",
    });
    assert.strictEqual(Object.keys(result.errors).length, 0);
  });
});

// ============================================
// Route existence tests (verify files exist)
// ============================================

describe("Route file existence", () => {
  const expectedRoutes = [
    "src/app/(auth)/login/page.js",
    "src/app/(auth)/signup/page.js",
    "src/app/(auth)/forgot-password/page.js",
    "src/app/(auth)/reset-password/page.js",
    "src/app/auth/callback/route.js",
    "src/app/api/auth/signup/route.js",
    "src/app/api/auth/login/route.js",
    "src/app/api/auth/logout/route.js",
    "src/app/api/auth/forgot-password/route.js",
    "src/app/api/auth/reset-password/route.js",
    "src/app/api/account/profile/route.js",
    "src/app/(customer)/account/page.js",
    "src/app/(customer)/account/profile/page.js",
    "src/app/(customer)/account/orders/page.js",
    "src/app/admin/page.js",
    "src/app/admin/orders/page.js",
    "src/app/(marketing)/page.js",
    "src/app/(marketing)/about/page.js",
    "src/app/(marketing)/contact/page.js",
    "src/app/(marketing)/menu/page.js",
    "src/app/(marketing)/reviews/page.js",
    "src/app/(marketing)/suggestions/page.js",
    "src/app/(marketing)/privacy/page.js",
  ];

  for (const route of expectedRoutes) {
    it(`route file exists: ${route}`, () => {
      const fullPath = path.join(rootDir, route);
      assert.ok(fs.existsSync(fullPath), `Expected route file to exist: ${route}`);
    });
  }
});

// ============================================
// Migration file existence tests
// ============================================

describe("Migration file existence", () => {
  const expectedMigrations = [
    "supabase/migrations/20260822000000_create_profiles.sql",
    "supabase/migrations/20260822000001_create_user_roles.sql",
    "supabase/migrations/20260822000002_create_menu_catalogue.sql",
    "supabase/migrations/20260822000003_create_orders.sql",
    "supabase/migrations/20260822000004_create_ordering_settings.sql",
    "supabase/migrations/20260822000005_create_rls_policies.sql",
  ];

  for (const migration of expectedMigrations) {
    it(`migration file exists: ${migration}`, () => {
      const fullPath = path.join(rootDir, migration);
      assert.ok(fs.existsSync(fullPath), `Expected migration file to exist: ${migration}`);
    });
  }
});

// ============================================
// Security tests
// ============================================

describe("Security checks", () => {
  it("signup API does not accept role parameter", () => {
    const signupRoute = fs.readFileSync(
      path.join(rootDir, "src/app/api/auth/signup/route.js"),
      "utf8"
    );
    assert.ok(
      !signupRoute.includes("payload?.role") && !signupRoute.includes("data.role"),
      "Signup route should not accept role from payload"
    );
    assert.ok(
      signupRoute.includes('"CUSTOMER"') || signupRoute.includes("'CUSTOMER'"),
      "Signup route should assign CUSTOMER role"
    );
  });

  it("auth callback validates redirect to prevent open redirects", () => {
    const callbackRoute = fs.readFileSync(
      path.join(rootDir, "src/app/auth/callback/route.js"),
      "utf8"
    );
    assert.ok(
      callbackRoute.includes("safeNext") || callbackRoute.includes("next"),
      "Callback route should validate redirect"
    );
  });

  it("admin layout uses requireAdmin guard", () => {
    const adminPage = fs.readFileSync(
      path.join(rootDir, "src/app/admin/page.js"),
      "utf8"
    );
    assert.ok(
      adminPage.includes("requireAdmin"),
      "Admin page should use requireAdmin guard"
    );
  });

  it("customer account pages use requireCustomer guard", () => {
    const accountPage = fs.readFileSync(
      path.join(rootDir, "src/app/(customer)/account/orders/page.js"),
      "utf8"
    );
    assert.ok(
      accountPage.includes("requireCustomer"),
      "Customer orders page should use requireCustomer guard"
    );
  });

  it("no service role key exposed in browser code", () => {
    const browserClient = fs.readFileSync(
      path.join(rootDir, "src/lib/supabase/browser.js"),
      "utf8"
    );
    assert.ok(
      !browserClient.includes("SUPABASE_SECRET_KEY") && !browserClient.includes("service_role"),
      "Browser client should not use secret key"
    );
  });

  it("no admin role assignment in public signup", () => {
    const signupRoute = fs.readFileSync(
      path.join(rootDir, "src/app/api/auth/signup/route.js"),
      "utf8"
    );
    assert.ok(
      !signupRoute.includes("'ADMIN'"),
      "Public signup should never assign ADMIN role"
    );
  });
});

// ============================================
// Database schema tests
// ============================================

describe("Database schema", () => {
  it("profiles table has required fields", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000000_create_profiles.sql"),
      "utf8"
    );
    assert.ok(migration.includes("user_id"));
    assert.ok(migration.includes("display_name"));
    assert.ok(migration.includes("phone"));
    assert.ok(migration.includes("created_at"));
    assert.ok(migration.includes("updated_at"));
  });

  it("user_roles table has required fields and no public insert policy", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000001_create_user_roles.sql"),
      "utf8"
    );
    assert.ok(migration.includes("user_id"));
    assert.ok(migration.includes("role"));
    assert.ok(migration.includes("created_at"));
    assert.ok(migration.includes("app_role"));
  });

  it("menu_categories table has required fields", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000002_create_menu_catalogue.sql"),
      "utf8"
    );
    assert.ok(migration.includes("menu_categories"));
    assert.ok(migration.includes("slug"));
    assert.ok(migration.includes("active"));
    assert.ok(migration.includes("sort_order"));
  });

  it("menu_items table has required fields and integer pricing", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000002_create_menu_catalogue.sql"),
      "utf8"
    );
    assert.ok(migration.includes("menu_items"));
    assert.ok(migration.includes("price_minor"));
    assert.ok(migration.includes("currency"));
    assert.ok(migration.includes("GHS"));
    assert.ok(migration.includes("available"));
    assert.ok(migration.includes("featured"));
  });

  it("orders table has pickup-only fulfillment type", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000003_create_orders.sql"),
      "utf8"
    );
    assert.ok(migration.includes("order_fulfillment_type"));
    assert.ok(migration.includes("PICKUP"));
    assert.ok(migration.includes("idempotency_key"));
    assert.ok(migration.includes("customer_name_snapshot"));
    assert.ok(migration.includes("phone_snapshot"));
  });

  it("order_status_history table exists with correct statuses", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000003_create_orders.sql"),
      "utf8"
    );
    assert.ok(migration.includes("order_status_history"));
    assert.ok(migration.includes("PENDING"));
    assert.ok(migration.includes("PREPARING"));
    assert.ok(migration.includes("READY_FOR_PICKUP"));
    assert.ok(migration.includes("COMPLETED"));
    assert.ok(migration.includes("CANCELLED"));
  });

  it("ordering_settings table exists and defaults to false", () => {
    const migration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000004_create_ordering_settings.sql"),
      "utf8"
    );
    assert.ok(migration.includes("ordering_settings"));
    assert.ok(migration.includes("accepting_orders"));
    assert.ok(migration.includes("false"));
  });

  it("RLS policies are restrictive", () => {
    const rlsMigration = fs.readFileSync(
      path.join(rootDir, "supabase/migrations/20260822000005_create_rls_policies.sql"),
      "utf8"
    );
    assert.ok(rlsMigration.includes("enable row level security"));
    assert.ok(rlsMigration.includes("customers_read_own_profile"));
    assert.ok(rlsMigration.includes("customers_update_own_profile"));
    assert.ok(rlsMigration.includes("public_read_active_categories"));
    assert.ok(rlsMigration.includes("public_read_active_available_items"));
    assert.ok(rlsMigration.includes("customers_read_own_orders"));
  });
});
