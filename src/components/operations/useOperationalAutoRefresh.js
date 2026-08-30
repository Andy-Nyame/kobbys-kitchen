"use client";

import { useEffect } from "react";

import { createOperationalRefreshController } from "@/lib/operations/auto-refresh";

export default function useOperationalAutoRefresh({ enabled, refresh }) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const controller = createOperationalRefreshController({
      refresh,
      visibilityTarget: document,
      focusTarget: window,
      scheduler: window,
    });

    return controller.start();
  }, [enabled, refresh]);
}
