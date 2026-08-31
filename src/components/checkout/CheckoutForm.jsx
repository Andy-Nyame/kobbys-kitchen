"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { useLiveOrderingStatus } from "@/components/operations/OperationalStatusProvider";
import { formatGhs, resolveCartLines } from "@/lib/cart/domain";
import { MAX_ORDER_NOTE_LENGTH } from "@/lib/orders/checkout-constants";

function getIdempotencyKey() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return null;
}

export default function CheckoutForm({ catalogueItems, customer, orderingStatus: initialOrderingStatus, paymentOptions }) {
  const router = useRouter();
  const orderingStatus = useLiveOrderingStatus(initialOrderingStatus);
  const { clearCart, hasLoaded, lines } = useCart();
  const [customerName, setCustomerName] = useState(customer.displayName);
  const [customerPhone, setCustomerPhone] = useState(customer.phone);
  const [note, setNote] = useState("");
  const initialPaymentMethod = paymentOptions.cashAvailable
    ? "CASH"
    : paymentOptions.methods.MOBILE_MONEY
      ? "MOBILE_MONEY"
      : "CARD";
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [feedback, setFeedback] = useState({ type: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const idempotencyKeyRef = useRef(null);
  const { resolvedLines, unresolvedLines } = resolveCartLines(lines, catalogueItems);
  const subtotalMinor = resolvedLines.reduce(
    (total, line) => total + line.lineTotalMinor,
    0
  );
  const canSubmit =
    hasLoaded &&
    orderingStatus.isOpen &&
    lines.length > 0 &&
    resolvedLines.length > 0 &&
    unresolvedLines.length === 0 &&
    resolvedLines.every((line) => line.orderable) &&
    feedback.type !== "submitting";

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    idempotencyKeyRef.current ||= getIdempotencyKey();

    if (!idempotencyKeyRef.current) {
      setFeedback({
        type: "error",
        message: "Secure checkout could not start. Refresh the page and try again.",
      });
      return;
    }

    setFieldErrors({});
    setFeedback({ type: "submitting", message: "Placing your pickup order…" });

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          customerName,
          customerPhone,
          note,
          paymentMethod,
          lines: resolvedLines.map((line) => ({
            menuItemId: line.menuItemId,
            priceTier: line.priceTier,
            quantity: line.quantity,
            expectedUnitPriceMinor: line.selectedPriceMinor,
          })),
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setFieldErrors(result?.errors || {});
        setFeedback({
          type: "error",
          message:
            result?.message ||
            "Your order could not be placed. Your cart has been kept.",
        });

        if (result?.code === "PRICE_CHANGED") {
          router.refresh();
        }
        return;
      }

      if (result.paymentRedirectTo) {
        setFeedback({
          type: "success",
          message: "Opening secure Paystack checkout…",
        });
        window.location.assign(result.paymentRedirectTo);
        return;
      }

      if (paymentMethod !== "CASH") {
        if (result.order?.paymentStatus === "PAID") {
          router.push(result.redirectTo);
          return;
        }
        setFeedback({
          type: "error",
          message: "Secure payment could not start. Opening your saved payment attempt…",
        });
        router.push(result.redirectTo);
        return;
      }

      setFeedback({
        type: "success",
        message:
          result.status === "already_created"
            ? "Your order was already placed. Opening its confirmation…"
            : "Order placed successfully. Opening your confirmation…",
      });
      clearCart();
      router.push(result.redirectTo);
    } catch {
      setFeedback({
        type: "error",
        message: "A network error interrupted checkout. Your cart has been kept.",
      });
    }
  }

  if (!hasLoaded) {
    return <p className="checkout-loading" role="status">Loading your saved cart…</p>;
  }

  if (lines.length === 0) {
    return (
      <section className="cart-empty-state">
        <h2>Your cart is empty.</h2>
        <p>Add a meal before starting checkout.</p>
        <Link className="button-link button-link--primary" href="/menu">
          Browse Menu
        </Link>
      </section>
    );
  }

  return (
    <form className="checkout-layout" onSubmit={handleSubmit} noValidate>
      <div className="checkout-layout__main">
        <section className="checkout-card" aria-labelledby="checkout-customer-title">
          <div className="checkout-card__heading">
            <p className="order-option-card__eyebrow">Customer details</p>
            <h2 id="checkout-customer-title">Who is collecting?</h2>
          </div>
          <div className="checkout-field-grid">
            <label className="form-field">
              <span>Pickup name</span>
              <input
                autoComplete="name"
                maxLength="80"
                onChange={(event) => setCustomerName(event.target.value)}
                value={customerName}
                aria-invalid={Boolean(fieldErrors.customerName)}
                aria-describedby={fieldErrors.customerName ? "checkout-name-error" : undefined}
              />
              {fieldErrors.customerName ? <span className="form-field__error" id="checkout-name-error">{fieldErrors.customerName}</span> : null}
            </label>
            <label className="form-field">
              <span>Email</span>
              <input autoComplete="email" readOnly type="email" value={customer.email} />
            </label>
            <label className="form-field">
              <span>Ghana phone number</span>
              <input
                autoComplete="tel"
                inputMode="tel"
                maxLength="40"
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="020 123 4567"
                value={customerPhone}
                aria-invalid={Boolean(fieldErrors.customerPhone)}
                aria-describedby={fieldErrors.customerPhone ? "checkout-phone-error" : undefined}
              />
              {fieldErrors.customerPhone ? <span className="form-field__error" id="checkout-phone-error">{fieldErrors.customerPhone}</span> : null}
            </label>
          </div>
        </section>

        <section className="checkout-card" aria-labelledby="checkout-pickup-title">
          <div className="checkout-card__heading">
            <p className="order-option-card__eyebrow">Fulfillment</p>
            <h2 id="checkout-pickup-title">Pickup only</h2>
            <p>Collect your order from Kobby&rsquo;s Kitchen after staff confirms it is ready.</p>
          </div>
          <label className="form-field">
            <span>Order note <small>(optional)</small></span>
            <textarea
              maxLength={MAX_ORDER_NOTE_LENGTH}
              onChange={(event) => setNote(event.target.value)}
              placeholder="For example: no pepper, or call when ready"
              rows="4"
              value={note}
              aria-invalid={Boolean(fieldErrors.note)}
              aria-describedby="checkout-note-help"
            />
            <span className="form-field__help" id="checkout-note-help">
              Plain-text preparation or pickup notes only. {note.length}/{MAX_ORDER_NOTE_LENGTH}
            </span>
            {fieldErrors.note ? <span className="form-field__error">{fieldErrors.note}</span> : null}
          </label>
          <div className="checkout-disabled-option" aria-disabled="true">
            <strong>Delivery</strong>
            <span>Coming soon</span>
          </div>
        </section>

        <fieldset className="checkout-card checkout-payment">
          <legend>Payment method</legend>
          <label className={`checkout-payment__option ${paymentMethod === "CASH" ? "checkout-payment__option--selected" : ""} ${!paymentOptions.cashAvailable ? "checkout-payment__option--disabled" : ""}`}>
            <input checked={paymentMethod === "CASH"} disabled={!paymentOptions.cashAvailable} name="paymentMethod" onChange={() => setPaymentMethod("CASH")} type="radio" value="CASH" />
            <span><strong>Cash at Pickup</strong><small>{paymentOptions.cashAvailable ? "Pay when collecting your order." : "Unavailable for online orders"}</small></span>
          </label>
          <label className={`checkout-payment__option ${paymentMethod === "MOBILE_MONEY" ? "checkout-payment__option--selected" : ""} ${!paymentOptions.methods.MOBILE_MONEY ? "checkout-payment__option--disabled" : ""}`}>
            <input checked={paymentMethod === "MOBILE_MONEY"} disabled={!paymentOptions.methods.MOBILE_MONEY} name="paymentMethod" onChange={() => setPaymentMethod("MOBILE_MONEY")} type="radio" value="MOBILE_MONEY" />
            <span><strong>Mobile Money</strong><small>{paymentOptions.methods.MOBILE_MONEY ? "Pay securely through hosted Paystack checkout." : "Online payment is not currently available."}</small></span>
          </label>
          <label className={`checkout-payment__option ${paymentMethod === "CARD" ? "checkout-payment__option--selected" : ""} ${!paymentOptions.methods.CARD ? "checkout-payment__option--disabled" : ""}`}>
            <input checked={paymentMethod === "CARD"} disabled={!paymentOptions.methods.CARD} name="paymentMethod" onChange={() => setPaymentMethod("CARD")} type="radio" value="CARD" />
            <span><strong>Card</strong><small>{paymentOptions.methods.CARD ? "Pay securely through hosted Paystack checkout." : "Online payment is not currently available."}</small></span>
          </label>
        </fieldset>
      </div>

      <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
        <div className="checkout-card__heading">
          <p className="order-option-card__eyebrow">Order summary</p>
          <h2 id="checkout-summary-title">Your pickup order</h2>
        </div>
        <ul className="checkout-summary__items">
          {resolvedLines.map((line) => (
            <li key={`${line.menuItemId}:${line.priceTier}`}>
              <div><strong>{line.item.name}</strong><span>{formatGhs(line.selectedPriceMinor)} × {line.quantity}</span></div>
              <strong>{formatGhs(line.lineTotalMinor)}</strong>
            </li>
          ))}
        </ul>
        {unresolvedLines.length > 0 || resolvedLines.some((line) => !line.orderable) ? (
          <p className="checkout-error" role="alert">
            Remove unavailable or outdated selections from your cart before checkout.
          </p>
        ) : null}
        <div className="checkout-summary__total"><span>Total</span><strong>{formatGhs(subtotalMinor)}</strong></div>
        <p className="checkout-summary__pickup">Pickup only · No delivery fee</p>
        {!orderingStatus.isOpen ? (
          <p className="checkout-error" role="status">
            Online ordering is currently closed. Your cart remains saved.
          </p>
        ) : null}
        {feedback.message ? (
          <p className={feedback.type === "error" ? "checkout-error" : "checkout-feedback"} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">
            {feedback.message}
          </p>
        ) : null}
        <button className="button-link button-link--primary checkout-submit" disabled={!canSubmit} type="submit">
          {feedback.type === "submitting"
            ? paymentMethod === "CASH" ? "Placing Order…" : "Starting Secure Payment…"
            : paymentMethod === "CASH" ? "Place Cash Pickup Order" : "Continue to Secure Payment"}
        </button>
        <Link className="text-link checkout-back-link" href="/cart">Return to Cart</Link>
      </aside>
    </form>
  );
}
