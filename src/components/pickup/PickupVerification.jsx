"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatOrderLabel, formatOrderMoney } from "@/lib/orders/presentation";

export default function PickupVerification({ compact = false }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [order, setOrder] = useState(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(action) {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Pickup verification failed.");
      setOrder(result.order);
      setFeedback(action === "RECORD_CASH" ? "Cash payment recorded." : action === "COMPLETE" ? "Pickup completed." : "Pickup code verified.");
      if (action === "COMPLETE") {
        setCode("");
        setOrder(null);
      }
      router.refresh();
    } catch (error) {
      setOrder(null);
      setFeedback(error instanceof Error ? error.message : "Pickup verification failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={compact ? "pickup-verifier pickup-verifier--compact" : "pickup-verifier"} aria-labelledby="pickup-verifier-title">
      <div>
        <p className="order-option-card__eyebrow">Secure handoff</p>
        <h2 id="pickup-verifier-title">Verify Pickup Code</h2>
        <p>Enter the customer&rsquo;s four-character code before recording payment or completing pickup.</p>
      </div>
      <form className="pickup-verifier__form" onSubmit={(event) => { event.preventDefault(); submit("VERIFY"); }}>
        <label className="form-field">
          <span>Pickup code</span>
          <input aria-describedby="pickup-code-hint" autoCapitalize="characters" autoComplete="off" inputMode="text" maxLength="4" onChange={(event) => setCode(event.target.value.toUpperCase().replace(/\s/g, ""))} pattern="[A-HJ-NP-Z0-9]{4}" required value={code} />
        </label>
        <p id="pickup-code-hint" className="form-hint">One letter and three numbers.</p>
        <button className="button-link button-link--primary" disabled={pending || code.length !== 4} type="submit">{pending ? "Checking…" : "Verify Code"}</button>
      </form>
      {feedback ? <p className="pickup-verifier__feedback" aria-live="polite" role="status">{feedback}</p> : null}
      {order ? (
        <div className="pickup-verifier__result">
          <div><strong>{order.pickupName}</strong><span>Order #{order.reference}</span></div>
          <ul>{order.items.map((item, index) => <li key={`${item.name}:${item.priceTier}:${index}`}>{item.quantity} × {item.name}</li>)}</ul>
          <dl>
            <div><dt>Total</dt><dd>{formatOrderMoney(order.totalMinor, order.currency)}</dd></div>
            <div><dt>Payment</dt><dd>{formatOrderLabel(order.paymentMethod)} · {formatOrderLabel(order.paymentStatus)}</dd></div>
          </dl>
          <div className="pickup-verifier__actions">
            {order.paymentMethod === "CASH" && order.paymentStatus === "UNPAID" ? <button className="button-link button-link--secondary" disabled={pending} onClick={() => submit("RECORD_CASH")} type="button">Record Cash Received</button> : null}
            <button className="button-link button-link--primary" disabled={pending || order.paymentStatus !== "PAID"} onClick={() => submit("COMPLETE")} type="button">Complete Pickup</button>
          </div>
          {order.paymentStatus !== "PAID" ? <p className="form-hint">Payment must be confirmed before pickup can be completed.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
