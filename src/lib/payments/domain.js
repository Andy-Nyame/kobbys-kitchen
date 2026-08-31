import { randomBytes } from "node:crypto";

import { PAYMENT_METHOD } from "../orders/domain.js";

export const PAYSTACK_PROVIDER = "PAYSTACK";
export const PAYSTACK_CHANNEL_BY_METHOD = Object.freeze({
  [PAYMENT_METHOD.MOBILE_MONEY]: "mobile_money",
  [PAYMENT_METHOD.CARD]: "card",
});

export const REFUND_STATUS = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
});

export class PaymentDomainError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = "PaymentDomainError";
    this.code = code;
    this.status = status;
  }
}

function enabled(name) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function getPaymentAvailability() {
  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
  const paystackAvailable = enabled("PAYSTACK_ENABLED") && paystackConfigured;
  const onlinePaymentRequired =
    paystackAvailable && enabled("ONLINE_PAYMENT_REQUIRED");

  return Object.freeze({
    paystackAvailable,
    paystackConfigured,
    onlinePaymentRequired,
    cashAvailable: !onlinePaymentRequired,
    methods: Object.freeze({
      [PAYMENT_METHOD.CASH]: !onlinePaymentRequired,
      [PAYMENT_METHOD.MOBILE_MONEY]: paystackAvailable,
      [PAYMENT_METHOD.CARD]: paystackAvailable,
    }),
  });
}

export function assertPaymentMethodAvailable(method, availability) {
  if (!availability?.methods?.[method]) {
    throw new PaymentDomainError(
      "PAYMENT_METHOD_UNAVAILABLE",
      method === PAYMENT_METHOD.CASH && availability?.onlinePaymentRequired
        ? "Cash at Pickup is unavailable for online orders. Choose Mobile Money or Card."
        : "That payment method is not currently available.",
      400
    );
  }
  return method;
}

export function isPaystackMethod(method) {
  return Object.hasOwn(PAYSTACK_CHANNEL_BY_METHOD, method);
}

export function createPaystackReference() {
  return `KKP-${Date.now().toString(36)}-${randomBytes(10).toString("hex")}`;
}

export function normalizePaystackReference(value) {
  const reference = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9.=-]{10,100}$/.test(reference)) {
    throw new PaymentDomainError("PAYMENT_REFERENCE_INVALID", "Payment reference is invalid.", 400);
  }
  return reference;
}

export function createReceiptNumber(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
  return `KKR-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function normalizeRefundStatus(value) {
  const status = String(value || "").toLowerCase().replaceAll("_", "-");
  if (status === "processed" || status === "success") return REFUND_STATUS.PROCESSED;
  if (status === "processing") return REFUND_STATUS.PROCESSING;
  if (status === "needs-attention" || status === "needs attention") {
    return REFUND_STATUS.NEEDS_ATTENTION;
  }
  if (status === "failed") return REFUND_STATUS.FAILED;
  return REFUND_STATUS.PENDING;
}

export function prepareFullRefundRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PaymentDomainError("REFUND_INVALID", "The refund request is invalid.", 400);
  }
  for (const field of ["role", "userId", "adminUserId", "paymentId", "amountMinor"]) {
    if (Object.hasOwn(payload, field)) {
      throw new PaymentDomainError("REFUND_INVALID", "Trusted refund data cannot be supplied by the browser.", 400);
    }
  }
  const reason = typeof payload.reason === "string"
    ? payload.reason.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
    : "";
  if (!reason || reason.length > 160) {
    throw new PaymentDomainError("REFUND_REASON_REQUIRED", "Enter a cancellation reason of 160 characters or fewer.", 400);
  }
  return { reason };
}

export function getSafeSiteUrl() {
  const configured = process.env.AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new PaymentDomainError(
        "PAYMENT_CONFIGURATION_ERROR",
        "Online payment configuration is incomplete.",
        503
      );
    }
    return "http://localhost:3000";
  }

  const url = new URL(configured);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((!local && url.protocol !== "https:") || (local && !["http:", "https:"].includes(url.protocol))) {
    throw new PaymentDomainError(
      "PAYMENT_CONFIGURATION_ERROR",
      "Online payment configuration is incomplete.",
      503
    );
  }
  return url.origin;
}
