import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/auth/redirects";

export async function POST(request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const requestedPath = new URL(request.url).searchParams.get("next");
  const redirectPath = getSafeRedirectPath(requestedPath, "/");

  return NextResponse.redirect(new URL(redirectPath, request.url), { status: 303 });
}
