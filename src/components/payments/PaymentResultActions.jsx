"use client";

import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";

export default function PaymentResultActions({ orderReference, paymentStatus, showSuccess }) {
  const { clearCart } = useCart();
  const cartCleared = useRef(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (showSuccess && paymentStatus === "PAID" && !cartCleared.current) {
      cartCleared.current = true;
      clearCart();
    }
  }, [clearCart, paymentStatus, showSuccess]);

  async function retry() {
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderReference }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Payment could not be restarted.");
      window.location.assign(result.redirectTo);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Payment could not be restarted.");
      setPending(false);
    }
  }

  if (paymentStatus === "PAID" && showSuccess) {
    return (
      <div className="order-confirmation-banner" role="status">
        <strong>Payment successful.</strong>
        <span>Your order has been placed and is awaiting restaurant confirmation.</span>
      </div>
    );
  }
  if (!new Set(["FAILED", "PENDING"]).has(paymentStatus)) return null;
  return (
    <section className="payment-result-card" aria-labelledby="payment-result-title">
      <h2 id="payment-result-title">{paymentStatus === "FAILED" ? "Payment was not completed" : "Waiting for payment"}</h2>
      <p>{paymentStatus === "FAILED"
        ? "Your order has not entered the kitchen queue. You can safely start a new payment attempt."
        : "Complete the hosted payment before this order can enter the kitchen queue."}</p>
      {paymentStatus === "FAILED" ? (
        <button className="button-link button-link--primary" disabled={pending} onClick={retry} type="button">
          {pending ? "Starting Payment…" : "Try Payment Again"}
        </button>
      ) : null}
      {feedback ? <p className="checkout-error" role="alert">{feedback}</p> : null}
    </section>
  );
}
