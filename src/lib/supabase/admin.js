import "server-only";

import { createClient } from "@supabase/supabase-js";

function createSupabaseConfigurationError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

function getLegacyJwtRole(key) {
  const parts = key.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function isSupabaseServerSecret(key) {
  if (key.startsWith("sb_secret_")) {
    return true;
  }

  if (key.startsWith("sb_publishable_")) {
    return false;
  }

  return getLegacyJwtRole(key) === "service_role";
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw createSupabaseConfigurationError(
      "missing_server_supabase_configuration"
    );
  }

  if (!isSupabaseServerSecret(supabaseSecretKey)) {
    throw createSupabaseConfigurationError(
      "supabase_secret_key_is_not_server_key"
    );
  }

  let parsedSupabaseUrl;

  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw createSupabaseConfigurationError("invalid_supabase_url");
  }

  if (
    !["http:", "https:"].includes(parsedSupabaseUrl.protocol) ||
    parsedSupabaseUrl.pathname.startsWith("/rest/") ||
    parsedSupabaseUrl.pathname.startsWith("/auth/")
  ) {
    throw createSupabaseConfigurationError("invalid_supabase_url");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
