import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createClient } from "@supabase/supabase-js";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

function createDevelopmentAdminClient() {
  assert.equal(process.env.APP_ENV, "development");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function createDevelopmentCustomerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

integrationDescribe("universal customer profile provisioning", () => {
  it("provisions one profile and CUSTOMER role for password and OAuth-shaped Auth users", async () => {
    const admin = createDevelopmentAdminClient();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordEmail = `profile-password-${suffix}@example.test`;
    const oauthEmail = `profile-oauth-${suffix}@example.test`;
    const password = "UniversalProfileTest!9";
    const userIds = [];

    try {
      const passwordUser = await admin.auth.admin.createUser({
        email: passwordEmail,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: "Password Customer",
          phone: "+233201234567",
        },
      });
      assert.equal(passwordUser.error, null);
      userIds.push(passwordUser.data.user.id);

      const oauthShapedUser = await admin.auth.admin.createUser({
        email: oauthEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: "OAuth Customer",
          picture: "https://images.example.test/oauth-customer.png",
        },
      });
      assert.equal(oauthShapedUser.error, null);
      userIds.push(oauthShapedUser.data.user.id);

      for (const [userId, expectedName, expectedPhone] of [
        [passwordUser.data.user.id, "Password Customer", "+233201234567"],
        [oauthShapedUser.data.user.id, "OAuth Customer", null],
      ]) {
        const [profile, role] = await Promise.all([
          admin
            .from("profiles")
            .select("display_name, phone", { count: "exact" })
            .eq("user_id", userId),
          admin
            .from("user_roles")
            .select("role", { count: "exact" })
            .eq("user_id", userId),
        ]);

        assert.equal(profile.error, null);
        assert.equal(profile.count, 1);
        assert.equal(profile.data[0].display_name, expectedName);
        assert.equal(profile.data[0].phone, expectedPhone);
        assert.equal(role.error, null);
        assert.equal(role.count, 1);
        assert.equal(role.data[0].role, "CUSTOMER");
      }

      await admin
        .from("profiles")
        .delete()
        .eq("user_id", passwordUser.data.user.id);

      const customer = createDevelopmentCustomerClient();
      const signIn = await customer.auth.signInWithPassword({
        email: passwordEmail,
        password,
      });
      assert.equal(signIn.error, null);

      const repair = await customer.rpc("ensure_current_customer_profile");
      assert.equal(repair.error, null);
      assert.equal(repair.data.display_name, "Password Customer");

      const [repairedProfile, repairedRole] = await Promise.all([
        admin
          .from("profiles")
          .select("user_id", { count: "exact" })
          .eq("user_id", passwordUser.data.user.id),
        admin
          .from("user_roles")
          .select("user_id", { count: "exact" })
          .eq("user_id", passwordUser.data.user.id),
      ]);
      assert.equal(repairedProfile.count, 1);
      assert.equal(repairedRole.count, 1);
    } finally {
      for (const userId of userIds) {
        await admin.from("profiles").delete().eq("user_id", userId);
        await admin.from("user_roles").delete().eq("user_id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });
});
