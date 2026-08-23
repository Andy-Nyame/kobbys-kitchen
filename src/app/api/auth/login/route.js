import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateLoginPayload,
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

  const validation = validateLoginPayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: AUTH_VALIDATION_MESSAGE, errors: validation.errors },
      { status: 400 }
    );
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[auth-login]", {
      message: error.message,
      code: error.status,
    });

    return NextResponse.json(
      {
        ok: false,
        message: "Invalid email or password.",
        errors: { auth: "Invalid email or password." },
      },
      { status: 401 }
    );
  }

  if (!data.session) {
    return NextResponse.json(
      { ok: false, message: AUTH_SERVER_ERROR_MESSAGE, errors: {} },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Signed in successfully.",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    },
    { status: 200 }
  );
}
