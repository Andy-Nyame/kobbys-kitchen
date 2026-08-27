import { NextResponse } from "next/server";

import { signIn } from "@/auth";
import {
  ADMIN_LOGIN_ERROR,
  getAdminLoginDecision,
} from "@/lib/auth/admin-login";
import { authenticateCredentials } from "@/lib/auth/credentials";
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

  const user = await authenticateCredentials({
    ...validation.data,
    role: "ADMIN",
  });

  if (!user) {
    console.error("[admin-login]", {
      category: "authentication_failed",
    });
    return deniedResponse();
  }

  const decision = getAdminLoginDecision({
    user,
    role: user.role,
    intendedPath: payload.next,
  });

  if (!decision.allowed) {
    console.error("[admin-login]", {
      category: "authorization_failed",
    });
    return deniedResponse();
  }

  try {
    await signIn("credentials", {
      ...validation.data,
      redirect: false,
      redirectTo: decision.redirectTo,
    });
  } catch (error) {
    console.error("[admin-login]", { category: error?.type || "signin_failed" });
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
