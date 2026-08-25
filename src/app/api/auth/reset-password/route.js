import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  getPasswordRecoveryCookieOptions,
  hasValidPasswordRecoveryProof,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/password-recovery";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateResetPasswordPayload,
} from "@/lib/validation/auth";

const INVALID_RECOVERY_MESSAGE =
  "Your password reset link is invalid or has expired. Please request a new one.";

async function getVerifiedRecoveryUser(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const proof = request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value;
  const proofIsValid = hasValidPasswordRecoveryProof(
    proof,
    user?.id,
    process.env.SUPABASE_SECRET_KEY
  );

  if (error || !user || !proofIsValid) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function GET(request) {
  const { user } = await getVerifiedRecoveryUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: INVALID_RECOVERY_MESSAGE },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}

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
  const { supabase, user } = await getVerifiedRecoveryUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: INVALID_RECOVERY_MESSAGE, errors: {} },
      { status: 401 }
    );
  }

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
        errors: {},
      },
      { status: 400 }
    );
  }

  await supabase.auth.signOut({ scope: "local" });

  const response = NextResponse.json(
    {
      ok: true,
      message: "Password updated successfully.",
    },
    { status: 200 }
  );

  response.cookies.set(PASSWORD_RECOVERY_COOKIE, "", {
    ...getPasswordRecoveryCookieOptions(),
    maxAge: 0,
  });

  return response;
}
