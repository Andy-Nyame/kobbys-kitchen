import { ORDER_STATUS, PAYMENT_METHOD } from "../orders/domain.js";

export const PAYMENT_WINDOW_MINUTES = 15;
export const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;
export const PAYMENT_EXPIRED_REASON = "PAYMENT_EXPIRED";
export const LATE_PAYSTACK_PAYMENT_REASON =
  "PAYMENT_EXPIRED_LATE_PAYSTACK_SUCCESS_REQUIRES_RECONCILIATION";
export const PAYMENT_EXPIRED_MESSAGE =
  "Payment wasn’t completed in time, so this order was not submitted to the kitchen.";

const PAYSTACK_METHODS = Object.freeze([
  PAYMENT_METHOD.MOBILE_MONEY,
  PAYMENT_METHOD.CARD,
]);

function timestamp(value, fieldName) {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${fieldName} must be a valid date.`);
  }
  return parsed;
}

export function getPaymentExpiryAt(createdAt) {
  return new Date(timestamp(createdAt, "Payment creation time") + PAYMENT_WINDOW_MS);
}

export function isWithinPaymentWindow(createdAt, paidOrCurrentAt) {
  return (
    timestamp(paidOrCurrentAt, "Payment time") <
    getPaymentExpiryAt(createdAt).getTime()
  );
}

export function isPaystackPaymentMethod(method) {
  return PAYSTACK_METHODS.includes(method);
}

export function isPaymentExpiredOrder(order) {
  return (
    order?.status === ORDER_STATUS.CANCELLED &&
    [PAYMENT_EXPIRED_REASON, LATE_PAYSTACK_PAYMENT_REASON].includes(
      order?.cancellationReason
    )
  );
}

export function requiresLatePaymentReconciliation(order) {
  return (
    order?.status === ORDER_STATUS.CANCELLED &&
    order?.cancellationReason === LATE_PAYSTACK_PAYMENT_REASON
  );
}

export function getCancellationReasonLabel(reason) {
  if (reason === PAYMENT_EXPIRED_REASON) return "Payment expired after 15 minutes.";
  if (reason === LATE_PAYSTACK_PAYMENT_REASON) {
    return "Late verified Paystack payment — manual reconciliation required.";
  }
  return reason || null;
}

export function getPaystackPaymentMethods() {
  return [...PAYSTACK_METHODS];
}
