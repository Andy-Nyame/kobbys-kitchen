const attempts = new Map();
const WINDOW_MS = 60_000;
const MAX_FAILURES = 8;

export function assertPickupAttemptAllowed(actorId, now = Date.now()) {
  const current = attempts.get(actorId);
  if (!current || current.resetAt <= now) return;
  if (current.failures >= MAX_FAILURES) {
    const error = new Error("Too many unsuccessful attempts. Wait a moment and try again.");
    error.status = 429;
    error.code = "PICKUP_RATE_LIMITED";
    throw error;
  }
}

export function recordPickupFailure(actorId, now = Date.now()) {
  const current = attempts.get(actorId);
  if (!current || current.resetAt <= now) {
    attempts.set(actorId, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.failures += 1;
}

export function clearPickupFailures(actorId) {
  attempts.delete(actorId);
}

export function resetPickupRateLimitForTests() {
  attempts.clear();
}
