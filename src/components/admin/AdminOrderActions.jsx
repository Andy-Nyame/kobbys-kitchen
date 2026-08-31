"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ADMIN_ORDER_ACTION, CANCELLATION_REASONS } from "@/lib/orders/admin-domain";

const PRIMARY_ACTION = {
  PENDING: { action: ADMIN_ORDER_ACTION.ACCEPT, label: "Accept Order" },
  CONFIRMED: { action: ADMIN_ORDER_ACTION.START_PREPARING, label: "Start Preparing" },
  PREPARING: { action: ADMIN_ORDER_ACTION.MARK_READY, label: "Mark Ready for Pickup" },
};

const CANCELLABLE = new Set(["PENDING", "CONFIRMED", "PREPARING"]);

export default function AdminOrderActions({ payment, reference, status }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reasonChoice, setReasonChoice] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const primary = PRIMARY_ACTION[status];
  const requiresRefund = payment?.status === "PAID" && payment?.provider === "PAYSTACK";

  async function submit(action, cancellationReason = null) {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(reference)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cancellationReason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Order update failed.");
      setFeedback(result.message);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Order update failed.");
    } finally {
      setPending(false);
    }
  }

  async function submitRefund(reason) {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(reference)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Refund could not be initiated.");
      setFeedback(result.message);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Refund could not be initiated.");
    } finally {
      setPending(false);
    }
  }

  if (!primary && !CANCELLABLE.has(status)) return null;
  const cancellationReason = reasonChoice === "Other" ? otherReason.trim() : reasonChoice;

  return (
    <div className="admin-order-actions">
      {primary ? (
        <button
          className="button-link button-link--primary"
          disabled={pending}
          onClick={() => submit(primary.action)}
          type="button"
        >
          {pending ? "Updating…" : primary.label}
        </button>
      ) : null}
      {CANCELLABLE.has(status) ? (
        <details className="admin-order-cancel">
          <summary>{requiresRefund ? "Cancel & Refund" : "Cancel Order"}</summary>
          <div className="admin-order-cancel__panel">
            <label className="form-field">
              <span>Cancellation reason <small>(optional)</small></span>
              <select disabled={pending} onChange={(event) => setReasonChoice(event.target.value)} value={reasonChoice}>
                <option value="">No reason selected</option>
                {CANCELLATION_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                <option value="Other">Other</option>
              </select>
            </label>
            {reasonChoice === "Other" ? (
              <label className="form-field">
                <span>Other reason</span>
                <input maxLength="160" onChange={(event) => setOtherReason(event.target.value)} value={otherReason} />
              </label>
            ) : null}
            <button
              className="button-link button-link--secondary"
              disabled={pending || (reasonChoice === "Other" && !otherReason.trim()) || (requiresRefund && !cancellationReason)}
              onClick={() => requiresRefund
                ? submitRefund(cancellationReason)
                : submit(ADMIN_ORDER_ACTION.CANCEL, cancellationReason || null)}
              type="button"
            >
              {pending ? "Updating…" : requiresRefund ? "Confirm Cancel & Refund" : "Confirm Cancellation"}
            </button>
          </div>
        </details>
      ) : null}
      {feedback ? <p aria-live="polite" className="admin-order-actions__feedback" role="status">{feedback}</p> : null}
    </div>
  );
}
