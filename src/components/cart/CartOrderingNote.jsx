"use client";

import { useLiveOrderingStatus } from "@/components/operations/OperationalStatusProvider";

export default function CartOrderingNote({ status: initialStatus }) {
  const status = useLiveOrderingStatus(initialStatus);

  if (status.isOpen) {
    return null;
  }

  return (
    <p className="cart-ordering-note">
      {status.businessDayClosed
        ? "Your cart is saved. Kobby’s Kitchen is closed today."
        : "Your cart is saved. Online ordering is currently closed."}
    </p>
  );
}
