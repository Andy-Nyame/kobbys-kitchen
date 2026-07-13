import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ADMIN_AUTH_CODES = new Set(["28000", "28P01", "PGRST301", "PGRST302"]);

function createHealthResponse(ok, reason, status) {
  return NextResponse.json(
    {
      ok,
      reason,
    },
    { status }
  );
}

function getAdminClientFailureReason(error) {
  if (error?.reason === "missing_supabase_secret_key") {
    return "missing_supabase_secret_key";
  }

  if (error?.reason === "invalid_supabase_secret_key_format") {
    return "invalid_supabase_secret_key";
  }

  return error?.reason || "supabase_admin_client_creation_error";
}

function isAdminAuthenticationError(error, status) {
  const code = error?.code || null;
  const message = typeof error?.message === "string" ? error.message : "";
  const hint = typeof error?.hint === "string" ? error.hint : "";

  return (
    ADMIN_AUTH_CODES.has(code) ||
    status === 401 ||
    /invalid api key|invalid jwt|jwt expired|unauthorized/i.test(
      `${message} ${hint}`
    )
  );
}

export async function GET() {
  let supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    return createHealthResponse(
      false,
      getAdminClientFailureReason(error),
      500
    );
  }

  try {
    const { error, status } = await supabase
      .schema("public")
      .from("reviews")
      .select("id")
      .limit(1);

    if (error) {
      return createHealthResponse(
        false,
        isAdminAuthenticationError(error, status)
          ? "invalid_supabase_secret_key"
          : "reviews_table_unreachable",
        isAdminAuthenticationError(error, status) ? 401 : 500
      );
    }
  } catch {
    return createHealthResponse(false, "reviews_table_unreachable", 500);
  }

  return createHealthResponse(true, "supabase_admin_connected", 200);
}
