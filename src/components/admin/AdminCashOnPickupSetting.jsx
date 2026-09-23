"use client";

import { useState } from "react";

export default function AdminCashOnPickupSetting({ initialEnabled }) {
  const [enabled, setEnabled] = useState(initialEnabled === true);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ ok: null, message: "" });

  async function update(nextEnabled) {
    setPending(true);
    setFeedback({ ok: null, message: "" });
    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashOnPickupEnabled: nextEnabled }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Payment settings could not be updated.");
      }
      setEnabled(result.result.cashOnPickupEnabled === true);
      setFeedback({ ok: true, message: result.message });
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-payment-setting">
      <label className="admin-payment-toggle">
        <span>
          <strong>Cash on Pickup</strong>
          <small>When enabled, eligible customers can choose Cash on Pickup at Checkout. Disabling it only affects new orders.</small>
        </span>
        <input
          aria-label={`Cash on Pickup, ${enabled ? "enabled" : "disabled"}`}
          checked={enabled}
          disabled={pending}
          onChange={(event) => update(event.target.checked)}
          type="checkbox"
        />
        <strong className="admin-payment-toggle__state">{pending ? "Saving…" : enabled ? "Enabled" : "Disabled"}</strong>
      </label>
      {feedback.message ? (
        <p
          aria-live="polite"
          className={feedback.ok === false ? "admin-inline-error" : "admin-operations-feedback"}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
