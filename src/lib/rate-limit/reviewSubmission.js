import "server-only";

import { createHash } from "node:crypto";

const RATE_LIMIT_ACTION = "review_submission";
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_IN_MS = 60 * 60 * 1000;
const UNKNOWN_IDENTIFIER_PREFIX = "unknown-ip";

function createRateLimitConfigurationError(reason) {
  const error = new Error(reason);
  error.reason = reason;
  return error;
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
    throw createRateLimitConfigurationError("missing_rate_limit_salt");
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

export async function enforceReviewSubmissionRateLimit({ request, supabase }) {
  const { value: clientIdentifier, usedFallback } = getClientIdentifier(request);
  const identifierHash = getIdentifierHash(clientIdentifier);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_IN_MS).toISOString();

  const { data, error } = await supabase
    .from("submission_rate_limits")
    .select("created_at")
    .eq("identifier_hash", identifierHash)
    .eq("action", RATE_LIMIT_ACTION)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(RATE_LIMIT_MAX_ATTEMPTS);

  if (error) {
    const wrappedError = createRateLimitConfigurationError(
      error.code === "42P01"
        ? "missing_submission_rate_limits_table"
        : "submission_rate_limit_query_failed"
    );

    wrappedError.code = error.code || null;
    wrappedError.usedFallbackIdentifier = usedFallback;
    throw wrappedError;
  }

  const attempts = data || [];

  if (attempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: createRetryAfterSeconds(attempts[0].created_at),
      usedFallbackIdentifier: usedFallback,
    };
  }

  const { error: insertError } = await supabase.from("submission_rate_limits").insert({
    identifier_hash: identifierHash,
    action: RATE_LIMIT_ACTION,
  });

  if (insertError) {
    const wrappedError = createRateLimitConfigurationError(
      insertError.code === "42P01"
        ? "missing_submission_rate_limits_table"
        : "submission_rate_limit_insert_failed"
    );

    wrappedError.code = insertError.code || null;
    wrappedError.usedFallbackIdentifier = usedFallback;
    throw wrappedError;
  }

  return {
    allowed: true,
    retryAfterSeconds: null,
    usedFallbackIdentifier: usedFallback,
  };
}
