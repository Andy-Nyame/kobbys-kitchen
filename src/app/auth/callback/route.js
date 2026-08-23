import { NextResponse } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth-callback]", {
      message: error.message,
      code: error.code,
    });
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", request.url)
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
