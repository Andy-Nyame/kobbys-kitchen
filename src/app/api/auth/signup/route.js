import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateSignupPayload,
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

  const validation = validateSignupPayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: AUTH_VALIDATION_MESSAGE, errors: validation.errors },
      { status: 400 }
    );
  }

  const { email, password, displayName, phone } = validation.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        phone: phone,
      },
    },
  });

  if (error) {
    console.error("[auth-signup]", {
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

  if (!data.user) {
    return NextResponse.json(
      { ok: false, message: AUTH_SERVER_ERROR_MESSAGE, errors: {} },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "Account created. Please check your email to confirm your account.",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    },
    { status: 201 }
  );
}
