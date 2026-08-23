import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateForgotPasswordPayload,
} from "@/lib/validation/auth";

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
  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin.replace(/\/$/, "")}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("[auth-forgot-password]", {
      message: error.message,
      code: error.status,
    });

    return NextResponse.json(
      {
        ok: false,
        message: AUTH_SERVER_ERROR_MESSAGE,
        errors: {},
      },
      { status: 400 }
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
