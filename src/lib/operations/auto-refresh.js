export const OPERATIONAL_REFRESH_INTERVAL_MS = 10_000;
export const OPERATIONAL_REFRESH_COALESCE_MS = 1_000;

export function pathMatchesOperationalSurface(
  pathname,
  { exactPaths = [], prefixPaths = [] } = {}
) {
  return (
    exactPaths.includes(pathname) ||
    prefixPaths.some((prefix) => pathname.startsWith(prefix))
  );
}

export function createOperationalRefreshController({
  refresh,
  visibilityTarget,
  focusTarget,
  scheduler,
  now = Date.now,
  intervalMs = OPERATIONAL_REFRESH_INTERVAL_MS,
  coalesceMs = OPERATIONAL_REFRESH_COALESCE_MS,
}) {
  let active = false;
  let intervalId = null;
  let inFlight = false;
  let lastRefreshAt = Number.NEGATIVE_INFINITY;

  function stopTimer() {
    if (intervalId !== null) {
      scheduler.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function refreshQuietly() {
    if (!active || visibilityTarget.hidden || inFlight) {
      return false;
    }

    const currentTime = now();
    if (currentTime - lastRefreshAt < coalesceMs) {
      return false;
    }

    lastRefreshAt = currentTime;

    try {
      const result = refresh();

      if (result && typeof result.then === "function") {
        inFlight = true;
        Promise.resolve(result)
          .catch(() => {})
          .finally(() => {
            inFlight = false;
          });
      }
    } catch {
      inFlight = false;
    }

    return true;
  }

  function startTimer() {
    if (!active || visibilityTarget.hidden || intervalId !== null) {
      return;
    }

    intervalId = scheduler.setInterval(refreshQuietly, intervalMs);
  }

  function handleVisibilityChange() {
    if (visibilityTarget.hidden) {
      stopTimer();
      return;
    }

    refreshQuietly();
    startTimer();
  }

  function handleFocus() {
    refreshQuietly();
  }

  function stop() {
    if (!active) {
      return;
    }

    active = false;
    stopTimer();
    visibilityTarget.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    focusTarget.removeEventListener("focus", handleFocus);
  }

  function start() {
    if (active) {
      return stop;
    }

    active = true;
    visibilityTarget.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    focusTarget.addEventListener("focus", handleFocus);
    startTimer();

    return stop;
  }

  return {
    start,
    stop,
    refreshNow: refreshQuietly,
    isTimerActive: () => intervalId !== null,
  };
}
