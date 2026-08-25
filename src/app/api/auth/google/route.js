import { NextResponse } from "next/server";

import { getGoogleOAuthCallbackUrl } from "@/lib/auth/google-oauth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const callbackUrl = getGoogleOAuthCallbackUrl(
    requestUrl,
    requestUrl.searchParams.get("next")
  );

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error || !data.url) {
    console.error("[auth-google-start]", {
      reason: error ? "oauth_start_failed" : "oauth_url_missing",
    });

    return NextResponse.redirect(
      new URL("/login?error=oauth_unavailable", request.url)
    );
  }

  return NextResponse.redirect(data.url);
}
