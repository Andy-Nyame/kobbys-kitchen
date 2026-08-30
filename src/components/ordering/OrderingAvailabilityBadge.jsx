"use client";

import { useLiveOrderingStatus } from "@/components/operations/OperationalStatusProvider";

export default function OrderingAvailabilityBadge({
  status: initialStatus,
  type = "online",
}) {
  const status = useLiveOrderingStatus(initialStatus);

  return (
    <span
      className={`order-option-card__status${type === "restaurant" && status.restaurantOpen ? " order-option-card__status--available" : ""}`}
    >
      {type === "restaurant"
        ? status.restaurantOpen
          ? "Restaurant open"
          : "Restaurant closed"
        : status.isOpen
          ? "Available now"
          : "Currently closed"}
    </span>
  );
}
