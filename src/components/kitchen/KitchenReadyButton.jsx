"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function KitchenReadyButton({ reference }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function markReady() {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/kitchen/orders/${encodeURIComponent(reference)}/ready`, { method: "POST" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Order update failed.");
      setFeedback("Order marked ready. Pickup code is now available to the customer.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Order update failed.");
    } finally {
      setPending(false);
    }
  }

  return <div className="kitchen-order__action"><button className="button-link button-link--primary" disabled={pending} onClick={markReady} type="button">{pending ? "Updating…" : "Mark Ready for Pickup"}</button>{feedback ? <p aria-live="polite" role="status">{feedback}</p> : null}</div>;
}
