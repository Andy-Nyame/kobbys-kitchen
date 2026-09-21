"use client";

import { useEffect, useMemo, useState } from "react";

function requestLines(lines) {
  return lines.map(({ menuItemId, priceTier, quantity }) => ({
    menuItemId,
    priceTier,
    quantity,
  }));
}

export async function fetchPromoPreview({ code, lines, signal }) {
  const response = await fetch("/api/promos/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, lines: requestLines(lines) }),
    signal,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(
      result?.message || "This promo could not be checked right now. Try again."
    );
    error.code = result?.code || "PROMO_PREVIEW_FAILED";
    throw error;
  }
  return result.promo;
}

export function usePromoPreview({ code, lines, onInvalid }) {
  const [state, setState] = useState({ key: null, status: "idle", promo: null, message: "" });
  const linesKey = useMemo(
    () =>
      lines
        .map((line) => `${line.menuItemId}:${line.priceTier}:${line.quantity}`)
        .join("|"),
    [lines]
  );
  const stableLines = useMemo(() => requestLines(lines), [lines]);
  const requestKey = code ? `${code}|${linesKey}` : null;

  useEffect(() => {
    if (!code || stableLines.length === 0) return undefined;
    const controller = new AbortController();
    fetchPromoPreview({ code, lines: stableLines, signal: controller.signal })
      .then((promo) => setState({ key: requestKey, status: "valid", promo, message: "" }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState({ key: requestKey, status: "error", promo: null, message: error.message });
        onInvalid?.(error);
      });
    return () => controller.abort();
  }, [code, onInvalid, requestKey, stableLines]);

  if (!requestKey) return { status: "idle", promo: null, message: "" };
  if (state.key !== requestKey) return { status: "loading", promo: null, message: "" };
  return state;
}
