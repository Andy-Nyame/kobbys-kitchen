import { formatGhs } from "../cart/domain.js";

const STATUS_LABELS = Object.freeze({
  AWAITING_PAYMENT: "Awaiting Payment",
  PENDING: "Confirmed",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  UNPAID: "Unpaid",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CASH: "Cash at Pickup",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Card",
  PICKUP: "Pickup",
});

export function formatOrderLabel(value) {
  if (!value) {
    return "Unavailable";
  }

  return (
    STATUS_LABELS[value] ||
    String(value)
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function formatOrderMoney(value, currency = "GHS") {
  return currency === "GHS" ? formatGhs(value) : `${currency} ${value}`;
}

export function formatOrderDateTime(value) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
