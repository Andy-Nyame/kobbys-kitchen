import "server-only";

import { createHash } from "node:crypto";

const RATE_LIMIT_ACTION = "review_submission";
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_IN_MS = 60 * 60 * 1000;
const UNKNOWN_IDENTIFIER_PREFIX = "unknown-ip";
const TABLE_MISMATCH_CODES = new Set(["42P01", "PGRST205"]);
const COLUMN_MISMATCH_CODES = new Set(["42703", "PGRST204"]);
const PERMISSION_ERROR_CODES = new Set(["42501"]);

function createRateLimitError({
  category,
  code = null,
  contractMismatchCategory = "none",
}) {
  const error = new Error(category);
  error.category = category;
  error.code = code;
  error.contractMismatchCategory = contractMismatchCategory;
  return error;
}

function classifySupabaseError(error, operation) {
  const code = error?.code || null;
  const message = typeof error?.message === "string" ? error.message : "";

  if (TABLE_MISMATCH_CODES.has(code)) {
    return createRateLimitError({
      category: "rate_limit_database_schema_error",
      code,
      contractMismatchCategory: "table",
    });
  }

  if (COLUMN_MISMATCH_CODES.has(code)) {
    return createRateLimitError({
      category: "rate_limit_database_schema_error",
      code,
      contractMismatchCategory: "column",
    });
  }

  if (PERMISSION_ERROR_CODES.has(code)) {
    return createRateLimitError({
      category: "rate_limit_database_permission_error",
      code,
    });
  }

  if (/fetch failed|network|timeout|econn|enotfound/i.test(message)) {
    return createRateLimitError({
      category: "rate_limit_database_connectivity_error",
      code,
    });
  }

  return createRateLimitError({
    category: `rate_limit_database_${operation}_error`,
    code,
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
    throw createRateLimitError({
      category: "rate_limit_configuration_error",
    });
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

function queryRecentAttempts({ supabase, identifierHash, windowStart }) {
  return supabase
    .schema("public")
    .from("submission_rate_limits")
    .select("created_at", { count: "exact" })
    .eq("identifier_hash", identifierHash)
    .eq("action", RATE_LIMIT_ACTION)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(RATE_LIMIT_MAX_ATTEMPTS);
}

export async function enforceReviewSubmissionRateLimit({ request, supabase }) {
  const { value: clientIdentifier, usedFallback } = getClientIdentifier(request);
  const identifierHash = getIdentifierHash(clientIdentifier);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_IN_MS).toISOString();

  let queryResult = await queryRecentAttempts({
    supabase,
    identifierHash,
    windowStart,
  });

  if (queryResult.error) {
    const classifiedError = classifySupabaseError(queryResult.error, "query");

    if (classifiedError.category === "rate_limit_database_connectivity_error") {
      queryResult = await queryRecentAttempts({
        supabase,
        identifierHash,
        windowStart,
      });
    }
  }

  const { data, count, error } = queryResult;

  if (error) {
    throw classifySupabaseError(error, "query");
  }

  const attempts = data || [];

  if (!Number.isInteger(count) || count < 0) {
    throw createRateLimitError({
      category: "rate_limit_database_query_error",
    });
  }

  if (count >= RATE_LIMIT_MAX_ATTEMPTS) {
    if (!attempts[0]?.created_at) {
      throw createRateLimitError({
        category: "rate_limit_database_query_error",
      });
    }

    return {
      allowed: false,
      retryAfterSeconds: createRetryAfterSeconds(attempts[0].created_at),
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
    throw classifySupabaseError(insertError, "insert");
  }

  return {
    allowed: true,
    retryAfterSeconds: null,
    usedFallbackIdentifier: usedFallback,
  };
}
