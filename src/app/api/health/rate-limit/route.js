import { NextResponse } from "next/server";

import { classifyRateLimitError } from "@/lib/rate-limit/reviewSubmission";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function createFailureResponse(reason, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      reason,
    },
    { status }
  );
}

function getSafeFailureReason(diagnostic) {
  if (diagnostic.tableAppearsMissing) {
    return "rate_limit_table_missing";
  }

  if (diagnostic.columnAppearsMissing) {
    return "rate_limit_column_mismatch";
  }

  if (diagnostic.authenticationFailed) {
    return "supabase_admin_auth_failed";
  }

  if (diagnostic.category === "permission_error") {
    return "supabase_admin_permission_denied";
  }

  if (diagnostic.category === "connectivity_error") {
    return "supabase_unreachable";
  }

  return "rate_limit_table_query_failed";
}

export async function GET() {
  let supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    const reason =
      error?.reason === "supabase_secret_key_is_not_server_key"
        ? "supabase_admin_auth_failed"
        : "supabase_admin_configuration_invalid";

    console.error("[review-rate-limit-health]", {
      operation: "create_admin_client",
      code: null,
      category: "configuration_error",
      hintCategory: reason,
      tableAppearsMissing: false,
      columnAppearsMissing: false,
      authenticationFailed: reason === "supabase_admin_auth_failed",
    });

    return createFailureResponse(reason);
  }

  const { error } = await supabase
    .schema("public")
    .from("submission_rate_limits")
    .select("id")
    .limit(1);

  if (error) {
    const diagnostic = classifyRateLimitError(error);

    console.error("[review-rate-limit-health]", {
      operation: "health_check_table",
      code: diagnostic.code,
      category: diagnostic.category,
      hintCategory: diagnostic.hintCategory,
      tableAppearsMissing: diagnostic.tableAppearsMissing,
      columnAppearsMissing: diagnostic.columnAppearsMissing,
      authenticationFailed: diagnostic.authenticationFailed,
    });

    return createFailureResponse(
      getSafeFailureReason(diagnostic),
      diagnostic.category === "connectivity_error" ? 503 : 500
    );
  }

  return NextResponse.json(
    {
      ok: true,
      reason: "rate_limit_table_reachable",
    },
    { status: 200 }
  );
}
