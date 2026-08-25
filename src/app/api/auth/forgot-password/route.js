import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateForgotPasswordPayload,
} from "@/lib/validation/auth";
import { getPasswordRecoveryRedirectUrl } from "@/lib/auth/password-recovery";

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: AUTH_INVALID_JSON_MESSAGE, errors: {} },
      { status: 400 }
    );
  }

  const validation = validateForgotPasswordPayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: AUTH_VALIDATION_MESSAGE, errors: validation.errors },
      { status: 400 }
    );
  }

  const { email } = validation.data;
  const supabase = await createClient();
  let redirectTo;

  try {
    redirectTo = getPasswordRecoveryRedirectUrl({ requestUrl: request.url });
  } catch (error) {
    console.error("[auth-forgot-password-redirect]", {
      reason: error.message,
    });

    return NextResponse.json(
      { ok: false, message: AUTH_SERVER_ERROR_MESSAGE, errors: {} },
      { status: 500 }
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("[auth-forgot-password]", {
      message: error.message,
      code: error.status,
    });

    // Supabase deliberately gives no account-existence signal. Preserve that
    // contract for provider-side 4xx responses too (including rate limits).
    if (error.status >= 400 && error.status < 500) {
      return NextResponse.json(
        {
          ok: true,
          message:
            "If an account exists with that email, a reset link has been sent.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { ok: false, message: AUTH_SERVER_ERROR_MESSAGE, errors: {} },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "If an account exists with that email, a reset link has been sent.",
    },
    { status: 200 }
  );
}
