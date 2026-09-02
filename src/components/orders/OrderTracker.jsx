import { getOrderProgress } from "@/lib/orders/presentation";
import { PAYMENT_EXPIRED_MESSAGE } from "@/lib/payments/expiry-policy";

export default function OrderTracker({
  status,
  cancellationReason = null,
  paymentExpired = false,
}) {
  const progress = getOrderProgress(status);
  if (progress.cancelled) {
    if (paymentExpired) {
      return (
        <section className="order-cancelled" aria-labelledby="payment-expired-title">
          <h2 id="payment-expired-title">Payment Expired</h2>
          <p>{PAYMENT_EXPIRED_MESSAGE}</p>
        </section>
      );
    }
    return (
      <section className="order-cancelled" aria-labelledby="order-cancelled-title">
        <h2 id="order-cancelled-title">Order Cancelled</h2>
        {cancellationReason ? <p><strong>Reason:</strong> {cancellationReason}</p> : <p>This order will not be prepared.</p>}
      </section>
    );
  }

  return (
    <section aria-labelledby="order-progress-title" className="order-tracker">
      <h2 id="order-progress-title">Order progress</h2>
      <ol className="order-tracker__steps">
        {progress.steps.map((step) => (
          <li aria-current={step.state === "current" ? "step" : undefined} className={`order-tracker__step order-tracker__step--${step.state}`} key={step.status}>
            <span aria-hidden="true" className="order-tracker__marker">{step.state === "complete" ? "✓" : "•"}</span>
            <span><strong>{step.label}</strong><small>{step.state === "complete" ? "Completed" : step.state === "current" ? "Current status" : "Upcoming"}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
