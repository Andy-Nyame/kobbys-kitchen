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
  let grossOrderValueMinor = 0;
  let nonCancelledOrderCount = 0;

  for (const order of orders) {
    if (!(order.status in orderStatusCounts)) {
      throw new TypeError(`Unsupported order status: ${String(order.status)}`);
    }

    orderStatusCounts[order.status] += 1;
    orderStatusById.set(order.id, order.status);
    if (order.status !== ORDER_STATUS.CANCELLED) {
      assertMinorAmount(order.total_minor || 0, "order.total_minor");
      grossOrderValueMinor += order.total_minor || 0;
      nonCancelledOrderCount += 1;
    }
  }

  const revenueByPaymentMethodMinor = createRevenueByPaymentMethod();
  const seenPaymentOrderIds = new Set();
  let paidRevenueMinor = 0;
  let paidOrderCount = 0;
  let unpaidCashValueMinor = 0;
  let cashUnpaidCount = 0;
  let pendingElectronicCount = 0;
  let failedElectronicCount = 0;

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

    const paymentOrderStatus =
      orderStatusById.get(payment.order_id) || payment.order_status;

    if (
      isRevenuePayment(payment) &&
      paymentOrderStatus !== ORDER_STATUS.CANCELLED
    ) {
      paidRevenueMinor += payment.amount_minor;
      revenueByPaymentMethodMinor[payment.method] += payment.amount_minor;
      paidOrderCount += 1;
      continue;
    }

    if (
      payment.method === PAYMENT_METHOD.CASH &&
      payment.status === PAYMENT_STATUS.UNPAID &&
      paymentOrderStatus !== ORDER_STATUS.CANCELLED
    ) {
      unpaidCashValueMinor += payment.amount_minor;
      cashUnpaidCount += 1;
    }

    if (
      payment.method !== PAYMENT_METHOD.CASH &&
      payment.status === PAYMENT_STATUS.PENDING
    ) {
      pendingElectronicCount += 1;
    }

    if (
      payment.method !== PAYMENT_METHOD.CASH &&
      payment.status === PAYMENT_STATUS.FAILED
    ) {
      failedElectronicCount += 1;
    }
  }

  return {
    totalOrders: orders.length,
    grossOrderValueMinor,
    averageOrderValueMinor:
      nonCancelledOrderCount === 0
        ? 0
        : Math.round(grossOrderValueMinor / nonCancelledOrderCount),
    orderStatusCounts,
    paidOrderCount,
    paidRevenueMinor,
    revenueByPaymentMethodMinor,
    unpaidCashValueMinor,
    paymentSummary: {
      cashPaidMinor: revenueByPaymentMethodMinor.CASH,
      cashUnpaidMinor: unpaidCashValueMinor,
      cashUnpaidCount,
      mobileMoneyPaidMinor: revenueByPaymentMethodMinor.MOBILE_MONEY,
      cardPaidMinor: revenueByPaymentMethodMinor.CARD,
      pendingElectronicCount,
      failedElectronicCount,
    },
    averagePaidOrderValueMinor:
      paidOrderCount === 0
        ? 0
        : Math.round(paidRevenueMinor / paidOrderCount),
  };
}

export function normalizeOrderMetricsRecord(record = {}) {
  const orderStatusCounts = record.order_status_counts || {};
  const revenueByMethod = record.revenue_by_payment_method_minor || {};
  const paymentSummary = record.payment_summary || {};

  return {
    totalOrders: Number(record.total_orders || 0),
    grossOrderValueMinor: Number(record.gross_order_value_minor || 0),
    averageOrderValueMinor: Number(record.average_order_value_minor || 0),
    orderStatusCounts: Object.fromEntries(
      Object.values(ORDER_STATUS).map((status) => [
        status,
        Number(orderStatusCounts[status] || 0),
      ])
    ),
    paidOrderCount: Number(record.paid_order_count || 0),
    paidRevenueMinor: Number(record.paid_revenue_minor || 0),
    revenueByPaymentMethodMinor: Object.fromEntries(
      Object.values(PAYMENT_METHOD).map((method) => [
        method,
        Number(revenueByMethod[method] || 0),
      ])
    ),
    unpaidCashValueMinor: Number(record.unpaid_cash_value_minor || 0),
    averagePaidOrderValueMinor: Number(
      record.average_paid_order_value_minor || 0
    ),
    paymentSummary: {
      cashPaidMinor: Number(paymentSummary.cash_paid_minor || 0),
      cashUnpaidMinor: Number(paymentSummary.cash_unpaid_minor || 0),
      cashUnpaidCount: Number(paymentSummary.cash_unpaid_count || 0),
      mobileMoneyPaidMinor: Number(
        paymentSummary.mobile_money_paid_minor || 0
      ),
      cardPaidMinor: Number(paymentSummary.card_paid_minor || 0),
      pendingElectronicCount: Number(
        paymentSummary.pending_electronic_count || 0
      ),
      failedElectronicCount: Number(
        paymentSummary.failed_electronic_count || 0
      ),
    },
    orderCountByDay: record.order_count_by_day || [],
    revenueByDay: record.revenue_by_day || [],
    topItems: record.top_items || [],
  };
}
