import { NextResponse } from "next/server";

import { signOut } from "@/auth";
import { getSafeRedirectPath } from "@/lib/auth/redirects";

export async function POST(request) {
  await signOut({ redirect: false });

  const requestedPath = new URL(request.url).searchParams.get("next");
  const redirectPath = getSafeRedirectPath(requestedPath, "/");

  return NextResponse.redirect(new URL(redirectPath, request.url), { status: 303 });
}
