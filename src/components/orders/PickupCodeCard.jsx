"use client";

import { useState } from "react";

export default function PickupCodeCard({ code }) {
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState("");
  const masked = "••••";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("Pickup code copied.");
    } catch {
      setFeedback("Copy was unavailable. Show the code and copy it manually.");
    }
  }

  return (
    <section className="pickup-code-card" aria-labelledby="pickup-code-title">
      <div><p className="order-option-card__eyebrow">Your order is ready for pickup</p><h2 id="pickup-code-title">Pickup code</h2><p>Show this code to a trusted team member when collecting your order.</p></div>
      <output className="pickup-code-card__code" aria-label={visible ? `Pickup code ${code}` : "Pickup code hidden"}>{visible ? code : masked}</output>
      <div className="pickup-code-card__actions"><button className="button-link button-link--secondary" onClick={() => { setVisible((current) => !current); setFeedback(""); }} type="button">{visible ? "Hide Code" : "Show Code"}</button><button className="button-link button-link--primary" onClick={copyCode} type="button">Copy Code</button></div>
      {feedback ? <p aria-live="polite" role="status">{feedback}</p> : null}
    </section>
  );
}
