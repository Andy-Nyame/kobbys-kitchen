import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const RESPONSE_BY_REASON = {
  connected: { ok: true, status: 200 },
  missing_environment_variables: { ok: false, status: 500 },
  invalid_supabase_url: { ok: false, status: 500 },
  invalid_publishable_key: { ok: false, status: 401 },
  network_error: { ok: false, status: 502 },
  rls_blocked: { ok: false, status: 403 },
  unexpected_database_error: { ok: false, status: 500 },
};

function createHealthResponse(reason) {
  const response = RESPONSE_BY_REASON[reason] || RESPONSE_BY_REASON.unexpected_database_error;
  const isProduction = process.env.NODE_ENV === "production";

  return NextResponse.json(
    isProduction
      ? {
          ok: response.ok,
        }
      : {
          ok: response.ok,
          reason,
        },
    { status: response.status }
  );
}

function getErrorText(error) {
  if (!error) {
    return "";
  }

  return `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`
    .toLowerCase()
    .trim();
}

function getReasonFromRouteError(error) {
  if (error?.reason === "missing_environment_variables") {
    return "missing_environment_variables";
  }

  if (error?.reason === "invalid_supabase_url") {
    return "invalid_supabase_url";
  }

  const errorText = getErrorText(error);

  if (
    error?.name === "TypeError" ||
    errorText.includes("fetch failed") ||
    errorText.includes("networkerror") ||
    errorText.includes("enotfound") ||
    errorText.includes("econnrefused") ||
    errorText.includes("getaddrinfo") ||
    errorText.includes("failed to fetch")
  ) {
    return "network_error";
  }

  return "unexpected_database_error";
}

function getReasonFromSupabaseError(error, status) {
  const errorText = getErrorText(error);

  return (
    error?.code === "42501" ||
    errorText.includes("row-level security") ||
    errorText.includes("permission denied") ||
    errorText.includes("violates row-level security")
  )
    ? "rls_blocked"
    : status === 401 ||
        errorText.includes("invalid api key") ||
        errorText.includes("invalid jwt") ||
        errorText.includes("jwt") ||
        errorText.includes("apikey")
      ? "invalid_publishable_key"
      : status === 0 ||
          errorText.includes("fetch failed") ||
          errorText.includes("networkerror") ||
          errorText.includes("failed to fetch")
        ? "network_error"
        : "unexpected_database_error";
}

export async function GET() {
  try {
    const supabase = createClient();
    const { error, status } = await supabase
      .from("reviews")
      .select("id")
      .limit(1);

    if (error) {
      return createHealthResponse(getReasonFromSupabaseError(error, status));
    }

    return createHealthResponse("connected");
  } catch (error) {
    return createHealthResponse(getReasonFromRouteError(error));
  }
}
