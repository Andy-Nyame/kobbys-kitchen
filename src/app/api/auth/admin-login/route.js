import { NextResponse } from "next/server";

import {
  ADMIN_LOGIN_ERROR,
  getAdminLoginDecision,
} from "@/lib/auth/admin-login";
import { createClient } from "@/lib/supabase/server";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateLoginPayload,
} from "@/lib/validation/auth";

function deniedResponse() {
  return NextResponse.json(
    {
      ok: false,
      message: ADMIN_LOGIN_ERROR,
      errors: { auth: ADMIN_LOGIN_ERROR },
    },
    { status: 401 }
  );
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

  const validation = validateLoginPayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: AUTH_VALIDATION_MESSAGE, errors: validation.errors },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(validation.data);

  if (error || !data.user || !data.session) {
    console.error("[admin-login]", {
      category: "authentication_failed",
      status: error?.status || null,
    });
    return deniedResponse();
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .single();
  const decision = getAdminLoginDecision({
    user: data.user,
    role: roleError ? null : roleRow?.role,
    intendedPath: payload.next,
  });

  if (!decision.allowed) {
    if (decision.clearSession) {
      await supabase.auth.signOut({ scope: "local" });
    }

    console.error("[admin-login]", {
      category: "authorization_failed",
      roleLookupFailed: Boolean(roleError),
    });
    return deniedResponse();
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Signed in successfully.",
      redirectTo: decision.redirectTo,
    },
    { status: 200 }
  );
}
