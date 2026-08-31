export function createKitchenWakeLockController({
  wakeLock,
  visibilityTarget,
  onFailure = () => {},
}) {
  let active = false;
  let sentinel = null;
  let requestPromise = null;
  let generation = 0;
  let lastFailure = null;

  function reportFailure(category) {
    if (lastFailure === category) return;
    lastFailure = category;
    onFailure(category);
  }

  function detachSentinel(current) {
    current?.removeEventListener?.("release", handleRelease);
  }

  function handleRelease() {
    detachSentinel(sentinel);
    sentinel = null;
  }

  async function release() {
    generation += 1;
    requestPromise = null;
    const current = sentinel;
    sentinel = null;
    detachSentinel(current);

    if (current && !current.released) {
      try {
        await current.release();
      } catch {
        // A browser-managed release is already sufficient for cleanup.
      }
    }
  }

  function request() {
    if (!active || visibilityTarget.hidden) return Promise.resolve(false);
    if (!wakeLock?.request) {
      reportFailure("unsupported");
      return Promise.resolve(false);
    }
    if (sentinel && !sentinel.released) return Promise.resolve(true);
    if (requestPromise) return requestPromise;

    const requestGeneration = generation;
    const currentRequest = Promise.resolve(wakeLock.request("screen"))
      .then(async (lock) => {
        if (
          !active ||
          visibilityTarget.hidden ||
          requestGeneration !== generation
        ) {
          if (!lock.released) await lock.release().catch(() => {});
          return false;
        }

        sentinel = lock;
        sentinel.addEventListener?.("release", handleRelease);
        lastFailure = null;
        return true;
      })
      .catch(() => {
        reportFailure("request_failed");
        return false;
      })
      .finally(() => {
        if (requestPromise === currentRequest) requestPromise = null;
      });

    requestPromise = currentRequest;

    return requestPromise;
  }

  function handleVisibilityChange() {
    if (visibilityTarget.hidden) {
      void release();
      return;
    }

    void request();
  }

  function stop() {
    if (!active) return;
    active = false;
    visibilityTarget.removeEventListener("visibilitychange", handleVisibilityChange);
    void release();
  }

  function start() {
    if (active) return stop;
    active = true;
    visibilityTarget.addEventListener("visibilitychange", handleVisibilityChange);
    void request();
    return stop;
  }

  return { request, start, stop };
}
