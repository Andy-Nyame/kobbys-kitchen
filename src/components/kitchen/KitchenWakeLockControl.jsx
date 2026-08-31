"use client";

import { useEffect, useRef, useState } from "react";

import {
  createKitchenWakeLockController,
  readKitchenWakeLockPreference,
  writeKitchenWakeLockPreference,
} from "@/lib/kitchen/wake-lock";

const FAILURE_MESSAGES = {
  unsupported: "Screen awake is not supported on this device.",
  unavailable: "Screen awake could not be enabled on this device.",
  released: "Screen awake was released by this device.",
};

export default function KitchenWakeLockControl() {
  const controllerRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("off");

  useEffect(() => {
    let mounted = true;
    const savedPreference = readKitchenWakeLockPreference(window.localStorage);
    const controller = createKitchenWakeLockController({
      wakeLock: navigator.wakeLock,
      visibilityTarget: document,
      onStatus: setStatus,
    });

    controllerRef.current = controller;
    queueMicrotask(() => {
      if (mounted) setEnabled(savedPreference);
    });
    const stop = controller.start(savedPreference);

    return () => {
      mounted = false;
      controllerRef.current = null;
      stop();
    };
  }, []);

  function handleChange(event) {
    const nextEnabled = event.target.checked;
    setEnabled(nextEnabled);
    setStatus(nextEnabled ? "requesting" : "off");
    writeKitchenWakeLockPreference(window.localStorage, nextEnabled);
    controllerRef.current?.setEnabled(nextEnabled);
  }

  return (
    <div className="kitchen-wake-lock">
      <label className="kitchen-wake-lock__control">
        <input
          checked={enabled}
          onChange={handleChange}
          role="switch"
          type="checkbox"
        />
        <span>Keep screen awake</span>
        <strong aria-hidden="true">{enabled ? "On" : "Off"}</strong>
      </label>
      {FAILURE_MESSAGES[status] ? (
        <span className="kitchen-wake-lock__message" role="status">
          {FAILURE_MESSAGES[status]}
        </span>
      ) : null}
    </div>
  );
}
