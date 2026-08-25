import { NextResponse } from "next/server";

import {
  getSafeCustomerRedirectPath,
  getSafeRedirectPath,
} from "@/lib/auth/redirects";
import {
  createPasswordRecoveryProof,
  getPasswordRecoveryCookieOptions,
} from "@/lib/auth/password-recovery";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const flow = requestUrl.searchParams.get("flow");
  const next =
    flow === "oauth"
      ? getSafeCustomerRedirectPath(requestUrl.searchParams.get("next"))
      : getSafeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code && !(tokenHash && type === "recovery")) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", request.url)
    );
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

  if (error) {
    console.error("[auth-callback]", {
      message: error.message,
      code: error.code,
    });
    return NextResponse.redirect(
      new URL("/login?error=auth_callback", request.url)
    );
  }

  const response = NextResponse.redirect(new URL(next, request.url));

  if (next === "/reset-password") {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const proof = createPasswordRecoveryProof(
      user?.id,
      process.env.SUPABASE_SECRET_KEY
    );

    if (userError || !proof) {
      console.error("[auth-callback-recovery]", {
        reason: userError ? "recovery_user_unavailable" : "recovery_proof_unavailable",
      });
      return NextResponse.redirect(
        new URL("/login?error=auth_callback", request.url)
      );
    }

    response.cookies.set(
      "kk_password_recovery",
      proof,
      getPasswordRecoveryCookieOptions()
    );
  }

  return response;
}
