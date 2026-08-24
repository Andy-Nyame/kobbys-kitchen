import { createClient } from "@supabase/supabase-js";

import { provisionPrimaryAdmin } from "../src/lib/auth/primary-admin.js";

function getRequiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function isLegacyServiceRoleKey(key) {
  const parts = key.split(".");

  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

function validateServerConfiguration(supabaseUrl, supabaseSecretKey) {
  let parsedUrl;

  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid.");
  }

  if (
    !supabaseSecretKey.startsWith("sb_secret_") &&
    !isLegacyServiceRoleKey(supabaseSecretKey)
  ) {
    throw new Error("SUPABASE_SECRET_KEY is not a supported server secret key.");
  }
}

async function main() {
  const supabaseUrl = getRequiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey = getRequiredEnvironmentValue("SUPABASE_SECRET_KEY");
  const primaryAdminEmail = getRequiredEnvironmentValue("PRIMARY_ADMIN_EMAIL");

  validateServerConfiguration(supabaseUrl, supabaseSecretKey);

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const result = await provisionPrimaryAdmin({
    email: primaryAdminEmail,
    loadAuthUsersPage: async ({ page, perPage }) => {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      return { users: data?.users || [], error };
    },
    inspectRoleStorage: async () => {
      const { error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .limit(0);

      return { error };
    },
    assignAdminRole: async (roleAssignment) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert(roleAssignment, { onConflict: "user_id" });

      return { error };
    },
  });

  console.log(`Primary admin provisioned for ${result.email} with role ${result.role}.`);
}

main().catch((error) => {
  console.error(`[primary-admin-bootstrap] ${error.message}`);
  process.exitCode = 1;
});
