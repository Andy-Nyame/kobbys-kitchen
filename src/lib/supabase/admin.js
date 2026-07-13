import "server-only";

import { createClient } from "@supabase/supabase-js";

function createSupabaseConfigurationError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
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

function isSupportedSecretKey(key) {
  return (
    (key.startsWith("sb_secret_") && key.length > "sb_secret_".length) ||
    isLegacyServiceRoleKey(key)
  );
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw createSupabaseConfigurationError("missing_supabase_url");
  }

  if (!supabaseSecretKey) {
    throw createSupabaseConfigurationError("missing_supabase_secret_key");
  }

  let parsedSupabaseUrl;

  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw createSupabaseConfigurationError("invalid_supabase_url");
  }

  if (
    parsedSupabaseUrl.protocol !== "https:" ||
    !parsedSupabaseUrl.hostname.endsWith(".supabase.co") ||
    parsedSupabaseUrl.username ||
    parsedSupabaseUrl.password
  ) {
    throw createSupabaseConfigurationError("invalid_supabase_url");
  }

  if (!isSupportedSecretKey(supabaseSecretKey)) {
    throw createSupabaseConfigurationError("invalid_supabase_secret_key_format");
  }

  try {
    return createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    throw createSupabaseConfigurationError(
      "supabase_admin_client_creation_error"
    );
  }
}
