import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createClient } from "@supabase/supabase-js";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

const REQUIRED_TABLES = [
  "profiles",
  "user_roles",
  "menu_categories",
  "menu_items",
  "orders",
  "order_items",
  "order_status_history",
  "ordering_settings",
  "payments",
  "payment_attempts",
  "reviews",
  "review_moderation_history",
];

function createDevelopmentAdminClient() {
  assert.equal(process.env.APP_ENV, "development");
  assert.ok(process.env.NEXT_PUBLIC_SUPABASE_URL);
  assert.ok(process.env.SUPABASE_SECRET_KEY);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

integrationDescribe("confirmed development Supabase activation", () => {
  it("exposes every required migrated table", async () => {
    const supabase = createDevelopmentAdminClient();

    for (const table of REQUIRED_TABLES) {
      const { error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      assert.equal(error, null, `${table} should be queryable`);
    }
  });

  it("keeps build and operational ordering disabled", async () => {
    const supabase = createDevelopmentAdminClient();
    const { data, error } = await supabase
      .from("ordering_settings")
      .select("accepting_orders")
      .eq("id", 1)
      .single();

    assert.equal(error, null);
    assert.equal(process.env.V2_ORDERING_ENABLED, "false");
    assert.equal(data.accepting_orders, false);
  });

  it("has the configured Auth user provisioned as ADMIN", async () => {
    const supabase = createDevelopmentAdminClient();
    const targetEmail = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase();
    assert.ok(targetEmail);

    const { data: authData, error: authError } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    assert.equal(authError, null);

    const authUser = authData.users.find(
      (user) => user.email?.trim().toLowerCase() === targetEmail
    );
    assert.ok(authUser?.id);

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.id)
      .single();

    assert.equal(roleError, null);
    assert.equal(role.role, "ADMIN");
  });

  it("returns honest empty-state analytics", async () => {
    const supabase = createDevelopmentAdminClient();
    const { data, error } = await supabase.rpc("get_admin_dashboard_metrics", {
      p_from: null,
      p_to: null,
    });

    assert.equal(error, null);
    assert.equal(data.total_orders, 0);
    assert.equal(data.paid_revenue_minor, 0);
  });
});
