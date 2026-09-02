"use client";

import { useEffect } from "react";

import { createOperationalRefreshController } from "@/lib/operations/auto-refresh";

const refreshSubscribers = new Set();
let sharedController = null;
let stopSharedController = null;

function runSubscribedRefreshes() {
  return Promise.allSettled(
    [...refreshSubscribers].map((refresh) => Promise.resolve().then(refresh))
  );
}

function subscribeToOperationalRefresh(refresh) {
  refreshSubscribers.add(refresh);

  if (!sharedController) {
    sharedController = createOperationalRefreshController({
      refresh: runSubscribedRefreshes,
      visibilityTarget: document,
      focusTarget: window,
      scheduler: window,
    });
    stopSharedController = sharedController.start();
  }

  return () => {
    refreshSubscribers.delete(refresh);
    if (refreshSubscribers.size === 0) {
      stopSharedController?.();
      sharedController = null;
      stopSharedController = null;
    }
  };
}

export default function useOperationalAutoRefresh({ enabled, refresh }) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return subscribeToOperationalRefresh(refresh);
  }, [enabled, refresh]);
}
