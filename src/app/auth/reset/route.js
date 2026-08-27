import { NextResponse } from "next/server";

import {
  getPasswordResetCookieOptions,
  getValidPasswordResetRecord,
  PASSWORD_RESET_COOKIE,
} from "@/lib/auth/password-reset-tokens";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const record = await getValidPasswordResetRecord(token);

  if (!record) {
    return NextResponse.redirect(
      new URL("/reset-password?error=invalid_or_expired", request.url)
    );
  }

  const response = NextResponse.redirect(new URL("/reset-password", request.url));
  response.cookies.set(
    PASSWORD_RESET_COOKIE,
    token,
    getPasswordResetCookieOptions()
  );
  return response;
}
