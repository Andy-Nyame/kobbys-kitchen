import { NextResponse } from "next/server";

import {
  createPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset-tokens";
import { canUsePasswordRecovery } from "@/lib/auth/password-recovery-policy";
import { prisma } from "@/lib/prisma";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateForgotPasswordPayload,
} from "@/lib/validation/auth";

const GENERIC_MESSAGE =
  "If an account exists with that email, a reset link has been sent.";

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

  try {
    const email = validation.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        accounts: { select: { type: true } },
      },
    });

    if (canUsePasswordRecovery(user)) {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = new URL("/auth/reset", process.env.AUTH_URL || request.url);
      resetUrl.searchParams.set("token", token);
      await sendPasswordResetEmail({
        email: user.email,
        resetUrl: resetUrl.toString(),
      });
    }
  } catch (error) {
    console.error("[auth-forgot-password]", {
      category: error?.message || "password_reset_request_failed",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      message: GENERIC_MESSAGE,
    },
    { status: 200 }
  );
}
