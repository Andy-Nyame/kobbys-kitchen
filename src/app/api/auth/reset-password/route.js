import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateResetPasswordPayload,
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

  const validation = validateResetPasswordPayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: AUTH_VALIDATION_MESSAGE, errors: validation.errors },
      { status: 400 }
    );
  }

  const { password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    console.error("[auth-reset-password]", {
      message: error.message,
      code: error.status,
    });

    return NextResponse.json(
      {
        ok: false,
        message: AUTH_SERVER_ERROR_MESSAGE,
        errors: { auth: error.message },
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Password updated successfully.",
    },
    { status: 200 }
  );
}
