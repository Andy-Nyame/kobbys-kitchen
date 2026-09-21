"use client";

import { useCallback, useEffect, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { fetchPromoPreview, usePromoPreview } from "./usePromoPreview";
import { formatGhs } from "@/lib/cart/domain";

export default function PromoCodeControl({ lines, onPreviewChange }) {
  const { applyPromoCode, promoCode, removePromoCode } = useCart();
  const [draft, setDraft] = useState(promoCode || "");
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState("");
  const removeInvalid = useCallback(() => removePromoCode(), [removePromoCode]);
  const preview = usePromoPreview({ code: promoCode, lines, onInvalid: removeInvalid });

  useEffect(() => {
    onPreviewChange?.(preview.status === "valid" ? preview.promo : null);
  }, [onPreviewChange, preview.promo, preview.status]);

  async function apply(event) {
    event.preventDefault();
    setApplying(true);
    setFeedback("");
    try {
      const promo = await fetchPromoPreview({ code: draft, lines });
      applyPromoCode(promo.code);
      setDraft(promo.code);
      setFeedback(`${promo.code} applied.`);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setApplying(false);
    }
  }

  function remove() {
    removePromoCode();
    setDraft("");
    setFeedback("Promo removed.");
  }
  const statusMessage = preview.status === "error" ? preview.message : feedback;

  return (
    <section className="cart-promo" aria-labelledby="cart-promo-title">
      <div>
        <h3 id="cart-promo-title">Promo code</h3>
        <p>One promo code may be used per order.</p>
      </div>
      {promoCode && preview.status === "valid" ? (
        <div className="cart-promo__applied">
          <div>
            <strong>{preview.promo.code}</strong>
            <span>{preview.promo.discountLabel}</span>
          </div>
          <strong className="cart-promo__discount">
            −{formatGhs(preview.promo.discountMinor)}
          </strong>
          <button className="cart-text-button" onClick={remove} type="button">
            Remove
          </button>
        </div>
      ) : (
        <form className="cart-promo__form" onSubmit={apply}>
          <label className="sr-only" htmlFor="cart-promo-code">Promo code</label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            id="cart-promo-code"
            maxLength="32"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Enter promo code"
            value={draft}
          />
          <button
            className="button-link button-link--secondary"
            disabled={applying || !draft.trim()}
            type="submit"
          >
            {applying ? "Checking…" : "Apply"}
          </button>
        </form>
      )}
      {promoCode && preview.status === "loading" ? (
        <p className="cart-promo__feedback" role="status">Rechecking promo…</p>
      ) : null}
      {statusMessage ? (
        <p className="cart-promo__feedback" aria-live="polite" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
