import { formatGhs } from "../cart/domain.js";

const STATUS_LABELS = Object.freeze({
  AWAITING_PAYMENT: "Awaiting Payment",
  PENDING: "Awaiting Confirmation",
  CONFIRMED: "Order Accepted · Food is Being Prepared",
  PREPARING: "Food is Being Prepared",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CANCELLED: "Order Cancelled",
  UNPAID: "Unpaid",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PROCESSING: "Processing",
  NEEDS_ATTENTION: "Needs Attention",
  CASH: "Cash at Pickup",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Card",
  PICKUP: "Pickup",
});

export const ORDER_PROGRESS_STEPS = Object.freeze([
  Object.freeze({ status: "PENDING", label: "Order Placed" }),
  Object.freeze({ status: "CONFIRMED", label: "Order Accepted" }),
  Object.freeze({ status: "PREPARING", label: "Preparing" }),
  Object.freeze({ status: "READY_FOR_PICKUP", label: "Ready for Pickup" }),
  Object.freeze({ status: "COMPLETED", label: "Completed" }),
]);

export function getOrderProgress(status) {
  if (status === "CANCELLED") {
    return { cancelled: true, currentIndex: -1, steps: [] };
  }

  const currentIndex = ORDER_PROGRESS_STEPS.findIndex((step) => step.status === status);
  return {
    cancelled: false,
    currentIndex,
    steps: ORDER_PROGRESS_STEPS.map((step, index) => ({
      ...step,
      state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
    })),
  };
}

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
