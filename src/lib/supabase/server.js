import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabaseConfigurationError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
}

export async function createClient() {
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

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The auth proxy refreshes
          // sessions before protected pages render.
        }
      },
    },
  });
}
