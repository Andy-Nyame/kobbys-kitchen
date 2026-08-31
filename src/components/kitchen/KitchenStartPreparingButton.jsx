"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function KitchenStartPreparingButton({ reference }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function startPreparing() {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/kitchen/orders/${encodeURIComponent(reference)}/preparing`,
        { method: "POST" }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "Preparation could not be started.");
      }
      setFeedback("Preparation started.");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Preparation could not be started."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="kitchen-order__action">
      <button
        className="button-link button-link--primary"
        disabled={pending}
        onClick={startPreparing}
        type="button"
      >
        {pending ? "Starting…" : "Start Preparing"}
      </button>
      {feedback ? <p aria-live="polite" role="status">{feedback}</p> : null}
    </div>
  );
}
