import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/account";

  if (code) {
    const supabase = await createClient();

    await supabase.auth.exchangeCodeForSession(code);
  }

  // Validate next to prevent open redirects
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ].filter(Boolean);

  let safeNext = "/account";

  if (next && next.startsWith("/")) {
    safeNext = next;
  } else if (next && allowedOrigins.some((origin) => next.startsWith(origin))) {
    const url = new URL(next);
    safeNext = url.pathname + url.search;
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
