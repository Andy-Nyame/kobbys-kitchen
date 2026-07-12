import "server-only";

import { createClient } from "@supabase/supabase-js";

function createSupabaseConfigurationError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw createSupabaseConfigurationError("missing_environment_variables");
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

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
