"use client";

import { useEffect } from "react";

import { createKitchenWakeLockController } from "@/lib/kitchen/wake-lock";

export default function KitchenWakeLock() {
  useEffect(() => {
    const controller = createKitchenWakeLockController({
      wakeLock: navigator.wakeLock,
      visibilityTarget: document,
      onFailure: (category) => {
        console.warn("[kitchen-wake-lock]", { category });
      },
    });

    return controller.start();
  }, []);

  return null;
}
