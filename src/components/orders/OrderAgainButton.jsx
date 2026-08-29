"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";

export default function OrderAgainButton({ lines, unavailableCount = 0 }) {
  const router = useRouter();
  const { replaceCart } = useCart();
  const [message, setMessage] = useState("");

  function orderAgain() {
    if (!lines.length) {
      setMessage("None of the items from this order are currently available.");
      return;
    }
    replaceCart(lines);
    router.push("/cart");
  }

  return (
    <div className="order-again">
      <button className="button-link button-link--primary" onClick={orderAgain} type="button">
        Order Again
      </button>
      {unavailableCount > 0 ? (
        <p className="order-again__notice" role="status">
          {unavailableCount} unavailable selection{unavailableCount === 1 ? " was" : "s were"} skipped. Current prices apply at checkout.
        </p>
      ) : null}
      {message ? <p className="order-again__notice" role="status">{message}</p> : null}
    </div>
  );
}
