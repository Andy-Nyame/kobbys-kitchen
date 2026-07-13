import "server-only";

import { createHash } from "node:crypto";

const RATE_LIMIT_ACTION = "review_submission";
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_IN_MS = 60 * 60 * 1000;
const UNKNOWN_IDENTIFIER_PREFIX = "unknown-ip";
const TABLE_MISMATCH_CODES = new Set(["42P01", "PGRST205"]);
const COLUMN_MISMATCH_CODES = new Set(["42703", "PGRST204"]);
const PERMISSION_ERROR_CODES = new Set(["42501"]);
const AUTHENTICATION_ERROR_CODES = new Set([
  "28000",
  "28P01",
  "PGRST301",
  "PGRST302",
]);

function createRateLimitError({ operation, diagnostic }) {
  const error = new Error(diagnostic.category);
  error.operation = operation;
  Object.assign(error, diagnostic);
  return error;
}

export function classifyRateLimitError(error) {
  const code = error?.code || null;
  const message = typeof error?.message === "string" ? error.message : "";
  const hint = typeof error?.hint === "string" ? error.hint : "";
  const status = Number.isInteger(error?.status) ? error.status : null;
  const tableAppearsMissing = TABLE_MISMATCH_CODES.has(code);
  const columnAppearsMissing = COLUMN_MISMATCH_CODES.has(code);
  const authenticationFailed =
    AUTHENTICATION_ERROR_CODES.has(code) ||
    status === 401 ||
    /invalid api key|invalid jwt|jwt expired|unauthorized/i.test(
      `${message} ${hint}`
    );

  let category = "database_error";
  let hintCategory = "no_safe_hint";

  if (tableAppearsMissing) {
    category = "schema_error";
    hintCategory = "table_missing";
  } else if (columnAppearsMissing) {
    category = "schema_error";
    hintCategory = "column_missing";
  } else if (authenticationFailed) {
    category = "authentication_error";
    hintCategory = "admin_auth_failed";
  } else if (PERMISSION_ERROR_CODES.has(code) || status === 403) {
    category = "permission_error";
    hintCategory = "permission_denied";
  } else if (/fetch failed|network|timeout|econn|enotfound/i.test(message)) {
    category = "connectivity_error";
    hintCategory = "upstream_unreachable";
  }

  return {
    code,
    category,
    hintCategory,
    tableAppearsMissing,
    columnAppearsMissing,
    authenticationFailed,
  };
}

function createRateLimitDatabaseError(error, operation) {
  return createRateLimitError({
    operation,
    diagnostic: classifyRateLimitError(error),
  });
}

function createRateLimitInternalError(operation, hintCategory) {
  return createRateLimitError({
    operation,
    diagnostic: {
      code: null,
      category: "internal_error",
      hintCategory,
      tableAppearsMissing: false,
      columnAppearsMissing: false,
      authenticationFailed: false,
    },
  });
}

function normalizeIpCandidate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const firstValue = value.split(",")[0]?.trim();

  if (!firstValue) {
    return null;
  }

  if (firstValue.startsWith("::ffff:")) {
    return firstValue.slice(7);
  }

  if (firstValue.startsWith("[") && firstValue.includes("]")) {
    return firstValue.slice(1, firstValue.indexOf("]"));
  }

  const colonCount = (firstValue.match(/:/g) || []).length;

  if (firstValue.includes(".") && colonCount === 1) {
    return firstValue.replace(/:\d+$/, "");
  }

  return firstValue;
}

function buildUnknownIdentifier(request) {
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown-agent";
  const acceptLanguage =
    request.headers.get("accept-language")?.trim() || "unknown-language";

  return `${UNKNOWN_IDENTIFIER_PREFIX}:${userAgent.slice(0, 120)}:${acceptLanguage.slice(0, 80)}`;
}

function getClientIdentifier(request) {
  const ipHeaders = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ];

  for (const headerValue of ipHeaders) {
    const normalizedIp = normalizeIpCandidate(headerValue);

    if (normalizedIp) {
      return {
        value: normalizedIp,
        usedFallback: false,
      };
    }
  }

  return {
    value: buildUnknownIdentifier(request),
    usedFallback: true,
  };
}

function getIdentifierHash(identifier) {
  const rateLimitSalt = process.env.RATE_LIMIT_SALT;

  if (!rateLimitSalt) {
    throw createRateLimitInternalError(
      "hash_client_identifier",
      "missing_rate_limit_salt"
    );
  }

  return createHash("sha256")
    .update(`${rateLimitSalt}:${identifier}`)
    .digest("hex");
}

function createRetryAfterSeconds(oldestCreatedAt) {
  const retryAfterInMs =
    new Date(oldestCreatedAt).getTime() + RATE_LIMIT_WINDOW_IN_MS - Date.now();

  return Math.max(1, Math.ceil(retryAfterInMs / 1000));
}

function countRecentAttempts({ supabase, identifierHash, windowStart }) {
  return supabase
    .schema("public")
    .from("submission_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("identifier_hash", identifierHash)
    .eq("action", RATE_LIMIT_ACTION)
    .gte("created_at", windowStart);
}

function readOldestAttempt({ supabase, identifierHash, windowStart }) {
  return supabase
    .schema("public")
    .from("submission_rate_limits")
    .select("created_at")
    .eq("identifier_hash", identifierHash)
    .eq("action", RATE_LIMIT_ACTION)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

export async function enforceReviewSubmissionRateLimit({ request, supabase }) {
  const { value: clientIdentifier, usedFallback } = getClientIdentifier(request);
  const identifierHash = getIdentifierHash(clientIdentifier);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_IN_MS).toISOString();

  let countResult = await countRecentAttempts({
    supabase,
    identifierHash,
    windowStart,
  });

  if (countResult.error) {
    const diagnostic = classifyRateLimitError(countResult.error);

    if (diagnostic.category === "connectivity_error") {
      countResult = await countRecentAttempts({
        supabase,
        identifierHash,
        windowStart,
      });
    }
  }

  const { count, error: countError } = countResult;

  if (countError) {
    throw createRateLimitDatabaseError(countError, "count_recent_attempts");
  }

  if (!Number.isInteger(count) || count < 0) {
    throw createRateLimitInternalError(
      "count_recent_attempts",
      "invalid_count_result"
    );
  }

  if (count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const { data: oldestAttempt, error: oldestAttemptError } =
      await readOldestAttempt({
        supabase,
        identifierHash,
        windowStart,
      });

    if (oldestAttemptError) {
      throw createRateLimitDatabaseError(
        oldestAttemptError,
        "read_oldest_attempt"
      );
    }

    if (!oldestAttempt?.created_at) {
      throw createRateLimitInternalError(
        "read_oldest_attempt",
        "missing_oldest_attempt"
      );
    }

    return {
      allowed: false,
      retryAfterSeconds: createRetryAfterSeconds(oldestAttempt.created_at),
      usedFallbackIdentifier: usedFallback,
    };
  }

  const { error: insertError } = await supabase
    .schema("public")
    .from("submission_rate_limits")
    .insert({
      identifier_hash: identifierHash,
      action: RATE_LIMIT_ACTION,
    });

  if (insertError) {
    throw createRateLimitDatabaseError(insertError, "record_attempt");
  }

  return {
    allowed: true,
    retryAfterSeconds: null,
    usedFallbackIdentifier: usedFallback,
  };
}
