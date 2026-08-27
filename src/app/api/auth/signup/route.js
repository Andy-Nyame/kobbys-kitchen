import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { hashPassword } from "@/lib/auth/credentials";
import { createCredentialsCustomer } from "@/lib/auth/provisioning";
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
  let user;

  try {
    user = await createCredentialsCustomer({
      email,
      passwordHash: await hashPassword(password),
      displayName,
      phone,
    });
  } catch (error) {
    console.error("[auth-signup]", {
      category:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : "signup_failed",
    });

    return NextResponse.json(
      {
        ok: false,
        message: AUTH_SERVER_ERROR_MESSAGE,
        errors: {},
      },
      { status: error?.code === "P2002" ? 409 : 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Account created. You can now sign in.",
      user: {
        id: user.id,
        email: user.email,
      },
    },
    { status: 201 }
  );
}
