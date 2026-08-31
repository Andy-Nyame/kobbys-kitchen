export const KITCHEN_WAKE_LOCK_STORAGE_KEY =
  "kobbys-kitchen:keep-screen-awake";

export function readKitchenWakeLockPreference(storage) {
  try {
    return storage?.getItem(KITCHEN_WAKE_LOCK_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeKitchenWakeLockPreference(storage, enabled) {
  try {
    storage?.setItem(KITCHEN_WAKE_LOCK_STORAGE_KEY, String(Boolean(enabled)));
    return true;
  } catch {
    return false;
  }
}

export function createKitchenWakeLockController({
  wakeLock,
  visibilityTarget,
  onStatus = () => {},
}) {
  let active = false;
  let enabled = false;
  let sentinel = null;
  let requestPromise = null;
  let generation = 0;

  function detachSentinel(current) {
    current?.removeEventListener?.("release", handleRelease);
  }

  function handleRelease() {
    detachSentinel(sentinel);
    sentinel = null;
    onStatus(enabled ? "released" : "off");
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

    if (!enabled) onStatus("off");
  }

  function request() {
    if (!active || !enabled || visibilityTarget.hidden) return Promise.resolve(false);
    if (!wakeLock?.request) {
      onStatus("unsupported");
      return Promise.resolve(false);
    }
    if (sentinel && !sentinel.released) return Promise.resolve(true);
    if (requestPromise) return requestPromise;

    const requestGeneration = generation;
    const currentRequest = Promise.resolve(wakeLock.request("screen"))
      .then(async (lock) => {
        if (
          !active ||
          !enabled ||
          visibilityTarget.hidden ||
          requestGeneration !== generation
        ) {
          if (!lock.released) await lock.release().catch(() => {});
          return false;
        }

        sentinel = lock;
        sentinel.addEventListener?.("release", handleRelease);
        onStatus("active");
        return true;
      })
      .catch(() => {
        onStatus("unavailable");
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

    if (enabled) void request();
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (enabled) {
      void request();
    } else {
      void release();
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    visibilityTarget.removeEventListener("visibilitychange", handleVisibilityChange);
    void release();
  }

  function start(initialEnabled = false) {
    if (active) return stop;
    active = true;
    enabled = Boolean(initialEnabled);
    visibilityTarget.addEventListener("visibilitychange", handleVisibilityChange);
    if (enabled) void request();
    return stop;
  }

  return { request, setEnabled, start, stop };
}
