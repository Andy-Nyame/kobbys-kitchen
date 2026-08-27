import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/credentials";
import {
  getPasswordResetCookieOptions,
  getValidPasswordResetRecord,
  PASSWORD_RESET_COOKIE,
} from "@/lib/auth/password-reset-tokens";
import { prisma } from "@/lib/prisma";
import {
  AUTH_INVALID_JSON_MESSAGE,
  AUTH_SERVER_ERROR_MESSAGE,
  AUTH_VALIDATION_MESSAGE,
  validateResetPasswordPayload,
} from "@/lib/validation/auth";

const INVALID_RECOVERY_MESSAGE =
  "Your password reset link is invalid or has expired. Please request a new one.";

async function getVerifiedRecoveryUser(request) {
  const token = request.cookies.get(PASSWORD_RESET_COOKIE)?.value;
  const record = await getValidPasswordResetRecord(token);
  return { token, record };
}

export async function GET(request) {
  const { record } = await getVerifiedRecoveryUser(request);

  if (!record) {
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
  const { record } = await getVerifiedRecoveryUser(request);

  if (!record) {
    return NextResponse.json(
      { ok: false, message: INVALID_RECOVERY_MESSAGE, errors: {} },
      { status: 401 }
    );
  }

  try {
    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new Error("password_reset_token_already_used");
      }

      await transaction.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    });
  } catch (error) {
    console.error("[auth-reset-password]", {
      category: error?.message || "password_update_failed",
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

  const response = NextResponse.json(
    {
      ok: true,
      message: "Password updated successfully.",
    },
    { status: 200 }
  );

  response.cookies.set(PASSWORD_RESET_COOKIE, "", {
    ...getPasswordResetCookieOptions(),
    maxAge: 0,
  });

  return response;
}
