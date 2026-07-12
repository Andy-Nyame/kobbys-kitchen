import "server-only";

import { createClient } from "@supabase/supabase-js";

function createSupabaseConfigurationError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw createSupabaseConfigurationError(
      "missing_server_supabase_configuration"
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
