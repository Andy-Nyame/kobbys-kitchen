import {
  assertMinorAmount,
  isRevenuePayment,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from "../orders/domain.js";

function createStatusCounts() {
  return Object.fromEntries(
    Object.values(ORDER_STATUS).map((status) => [status, 0])
  );
}

function createRevenueByPaymentMethod() {
  return Object.fromEntries(
    Object.values(PAYMENT_METHOD).map((method) => [method, 0])
  );
}

export function summarizeOrderMetrics({ orders = [], payments = [] } = {}) {
  const orderStatusCounts = createStatusCounts();
  const orderStatusById = new Map();

  for (const order of orders) {
    if (!(order.status in orderStatusCounts)) {
      throw new TypeError(`Unsupported order status: ${String(order.status)}`);
    }

    orderStatusCounts[order.status] += 1;
    orderStatusById.set(order.id, order.status);
  }

  const revenueByPaymentMethodMinor = createRevenueByPaymentMethod();
  const seenPaymentOrderIds = new Set();
  let paidRevenueMinor = 0;
  let paidOrderCount = 0;
  let unpaidCashValueMinor = 0;

  for (const payment of payments) {
    if (seenPaymentOrderIds.has(payment.order_id)) {
      throw new TypeError(
        `Multiple logical payments found for order: ${String(payment.order_id)}`
      );
    }

    if (!(payment.method in revenueByPaymentMethodMinor)) {
      throw new TypeError(`Unsupported payment method: ${String(payment.method)}`);
    }

    seenPaymentOrderIds.add(payment.order_id);
    assertMinorAmount(payment.amount_minor, "payment.amount_minor");

    if (isRevenuePayment(payment)) {
      paidRevenueMinor += payment.amount_minor;
      revenueByPaymentMethodMinor[payment.method] += payment.amount_minor;
      paidOrderCount += 1;
      continue;
    }

    if (
      payment.method === PAYMENT_METHOD.CASH &&
      payment.status === PAYMENT_STATUS.UNPAID &&
      orderStatusById.get(payment.order_id) !== ORDER_STATUS.CANCELLED
    ) {
      unpaidCashValueMinor += payment.amount_minor;
    }
  }

  return {
    totalOrders: orders.length,
    orderStatusCounts,
    paidOrderCount,
    paidRevenueMinor,
    revenueByPaymentMethodMinor,
    unpaidCashValueMinor,
    averagePaidOrderValueMinor:
      paidOrderCount === 0
        ? 0
        : Math.round(paidRevenueMinor / paidOrderCount),
  };
}
