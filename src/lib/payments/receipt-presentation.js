import { formatOrderLabel, formatOrderMoney } from "../orders/presentation.js";

export const RECEIPT_COPY = Object.freeze({
  CUSTOMER: "CUSTOMER",
  ORIGINAL: "ORIGINAL",
});

function formatReceiptDate(value) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatReceiptTime(value) {
  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getReceiptCopyLabel(copyType) {
  return copyType === RECEIPT_COPY.ORIGINAL ? "ORIGINAL COPY" : "CUSTOMER COPY";
}

export function getReceiptRefundLabel(status) {
  if (!status) return null;
  if (status === "PROCESSED") return "REFUNDED";
  if (status === "PENDING" || status === "PROCESSING") return "PROCESSING";
  return formatOrderLabel(status).toUpperCase();
}

export function createReceiptPresentation(receipt, copyType = RECEIPT_COPY.CUSTOMER) {
  const payment = receipt.payment;
  const order = payment.order;

  return {
    copyLabel: getReceiptCopyLabel(copyType),
    receiptNumber: receipt.receiptNumber,
    orderReference: order.reference,
    paymentDate: formatReceiptDate(receipt.issuedAt),
    paymentTime: formatReceiptTime(receipt.issuedAt),
    pickupName: order.customerNameSnapshot,
    fulfillment: formatOrderLabel(order.fulfillmentType),
    paymentMethod: formatOrderLabel(payment.method),
    paymentStatus: "PAID",
    paymentProvider: payment.provider ? formatOrderLabel(payment.provider) : null,
    providerReference: payment.providerRef || null,
    refundStatus: getReceiptRefundLabel(payment.refund?.status),
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      priceTier: item.priceTier,
      quantity: item.quantity,
      unitPrice: formatOrderMoney(item.unitPriceMinor, order.currency),
      lineTotal: formatOrderMoney(item.lineTotalMinor, order.currency),
    })),
    total: formatOrderMoney(order.totalMinor, order.currency),
  };
}
