import { NextResponse } from "next/server";

import { googleAuthConfigured, signIn } from "@/auth";
import { getSafeCustomerRedirectPath } from "@/lib/auth/redirects";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const redirectTo = getSafeCustomerRedirectPath(
    requestUrl.searchParams.get("next")
  );

  if (!googleAuthConfigured) {
    console.error("[auth-google-start]", {
      reason: "oauth_not_configured",
    });

    return NextResponse.redirect(
      new URL("/login?error=oauth_unavailable", request.url)
    );
  }

  try {
    const url = await signIn("google", { redirect: false, redirectTo });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[auth-google-start]", {
      reason: error?.type || "oauth_start_failed",
    });
    return NextResponse.redirect(
      new URL("/login?error=oauth_unavailable", request.url)
    );
  }
}
