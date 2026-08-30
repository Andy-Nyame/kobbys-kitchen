export const PAYMENT_METHOD = Object.freeze({
  CASH: "CASH",
  MOBILE_MONEY: "MOBILE_MONEY",
  CARD: "CARD",
});

export const PAYMENT_STATUS = Object.freeze({
  UNPAID: "UNPAID",
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
});

export const PAYMENT_ATTEMPT_STATUS = Object.freeze({
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
});

export const ORDER_STATUS = Object.freeze({
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

const INITIAL_STATE_BY_PAYMENT_METHOD = Object.freeze({
  [PAYMENT_METHOD.CASH]: Object.freeze({
    orderStatus: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.UNPAID,
  }),
  [PAYMENT_METHOD.MOBILE_MONEY]: Object.freeze({
    orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
    paymentStatus: PAYMENT_STATUS.PENDING,
  }),
  [PAYMENT_METHOD.CARD]: Object.freeze({
    orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
    paymentStatus: PAYMENT_STATUS.PENDING,
  }),
});

const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.AWAITING_PAYMENT]: Object.freeze([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.PENDING]: Object.freeze([
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.CONFIRMED]: Object.freeze([
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.PREPARING]: Object.freeze([
    ORDER_STATUS.READY_FOR_PICKUP,
    ORDER_STATUS.CANCELLED,
  ]),
  [ORDER_STATUS.READY_FOR_PICKUP]: Object.freeze([
    ORDER_STATUS.COMPLETED,
  ]),
  [ORDER_STATUS.COMPLETED]: Object.freeze([]),
  [ORDER_STATUS.CANCELLED]: Object.freeze([]),
});

const PAYMENT_TRANSITIONS = Object.freeze({
  [PAYMENT_STATUS.UNPAID]: Object.freeze([PAYMENT_STATUS.PAID]),
  [PAYMENT_STATUS.PENDING]: Object.freeze([
    PAYMENT_STATUS.PAID,
    PAYMENT_STATUS.FAILED,
  ]),
  [PAYMENT_STATUS.PAID]: Object.freeze([PAYMENT_STATUS.REFUNDED]),
  [PAYMENT_STATUS.FAILED]: Object.freeze([PAYMENT_STATUS.PENDING]),
  [PAYMENT_STATUS.REFUNDED]: Object.freeze([]),
});

export function getInitialOrderPaymentState(paymentMethod) {
  const initialState = INITIAL_STATE_BY_PAYMENT_METHOD[paymentMethod];

  if (!initialState) {
    throw new TypeError(`Unsupported payment method: ${String(paymentMethod)}`);
  }

  return initialState;
}

export function canTransitionOrderStatus(currentStatus, nextStatus) {
  return ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function assertOrderStatusTransition(currentStatus, nextStatus) {
  if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
    throw new TypeError(
      `Invalid order status transition: ${String(currentStatus)} -> ${String(nextStatus)}`
    );
  }
}

export function canTransitionPaymentStatus(currentStatus, nextStatus) {
  return PAYMENT_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function assertMinorAmount(value, fieldName = "amountMinor") {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer`);
  }

  return value;
}

export function isRevenuePayment(payment) {
  return payment?.status === PAYMENT_STATUS.PAID;
}
