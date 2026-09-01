import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { summarizeOrderMetrics } from "../lib/analytics/order-metrics.js";
import { validateCheckoutPayload } from "../lib/orders/checkout-domain.js";
import {
  createReceiptNumber,
  getPaymentAvailability,
  normalizeRefundStatus,
  prepareFullRefundRequest,
} from "../lib/payments/domain.js";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "../lib/payments/providers/paystack.js";
import { buildReceiptPdf } from "../lib/payments/receipt-pdf.js";
import { getAuthorizedReceipt } from "../lib/payments/receipts.js";
import {
  finalizeVerifiedPaystackPayment,
  initiateFullPaystackRefund,
  markPaystackPaymentNotSuccessful,
  processPaystackRefundEvent,
  retryPaystackPayment,
} from "../lib/payments/service.js";

const originalEnv = { ...process.env };

function resetPaystackEnv() {
  for (const name of ["PAYSTACK_SECRET_KEY", "PAYSTACK_ENABLED", "ONLINE_PAYMENT_REQUIRED", "CASH_ON_PICKUP_ALLOWED_EMAILS", "AUTH_URL"]) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
}

function paymentDouble() {
  const state = {
    order: { id: "order-1", reference: "KK-20260830-PAY001", userId: "customer-1", status: "AWAITING_PAYMENT", paymentStatus: "PENDING" },
    payment: { id: "payment-1", method: "CARD", status: "PENDING", amountMinor: 11000, currency: "GHS", provider: "PAYSTACK", providerRef: null, paidAt: null, receipt: null },
    attempt: { id: "attempt-1", paymentId: "payment-1", provider: "PAYSTACK", status: "PENDING", amountMinor: 11000, currency: "GHS", providerRef: "KKP-test-reference-1", providerTransactionId: null },
    receiptCreates: 0,
  };
  function attemptRecord() {
    return { ...state.attempt, payment: { ...state.payment, receipt: state.payment.receipt, order: state.order } };
  }
  const transaction = {
    paymentAttempt: {
      findUnique: async () => attemptRecord(),
      update: async ({ data }) => Object.assign(state.attempt, data),
      updateMany: async ({ data }) => { Object.assign(state.attempt, data); return { count: 1 }; },
    },
    payment: {
      findUnique: async () => ({ id: state.payment.id, status: state.payment.status, receipt: state.payment.receipt }),
      update: async ({ data }) => Object.assign(state.payment, data),
      updateMany: async ({ data }) => { Object.assign(state.payment, data); return { count: 1 }; },
    },
    order: {
      updateMany: async ({ data }) => { Object.assign(state.order, data); return { count: 1 }; },
    },
    receipt: {
      create: async ({ data }) => {
        state.receiptCreates += 1;
        state.payment.receipt = { id: "receipt-1", ...data };
        return state.payment.receipt;
      },
    },
  };
  return {
    state,
    client: {
      ...transaction,
      paymentAttempt: { ...transaction.paymentAttempt, findUnique: async () => attemptRecord() },
      $transaction: async (value) => typeof value === "function" ? value(transaction) : Promise.all(value),
    },
  };
}

function refundDouble(role = "ADMIN") {
  const state = {
    order: {
      id: "order-1",
      reference: "KK-20260830-PAY001",
      status: "PENDING",
      payment: {
        id: "payment-1",
        status: "PAID",
        provider: "PAYSTACK",
        providerRef: "KKP-test-reference-1",
        amountMinor: 11000,
        currency: "GHS",
        refund: null,
      },
    },
    history: [],
  };
  const transaction = {
    user: { findUnique: async () => ({ role }) },
    order: {
      findUnique: async () => state.order,
      update: async ({ data }) => Object.assign(state.order, data),
    },
    orderStatusHistory: { create: async ({ data }) => state.history.push(data) },
    refund: {
      create: async ({ data }) => {
        state.order.payment.refund = { id: "refund-1", ...data };
        return state.order.payment.refund;
      },
      update: async ({ data }) => Object.assign(state.order.payment.refund, data),
    },
    payment: { update: async ({ data }) => Object.assign(state.order.payment, data) },
  };
  return {
    state,
    client: {
      ...transaction,
      payment: {
        ...transaction.payment,
        findUnique: async () => ({ ...state.order.payment, refund: state.order.payment.refund }),
      },
      $transaction: async (callback) => callback(transaction),
    },
  };
}

describe("Paystack configuration and hosted provider boundary", () => {
  it("keeps the public order page aligned with live payment availability", async () => {
    const orderPage = await readFile("src/app/(marketing)/order/page.js", "utf8");
    assert.match(orderPage, /getPaymentAvailability/);
    assert.match(orderPage, /Eligible accounts may also see Cash on Pickup/);
    assert.doesNotMatch(orderPage, /Mobile Money, Card, and delivery are coming soon/);
    assert.doesNotMatch(orderPage, /only live checkout method/);
  });

  it("keeps Cash fail-closed while preserving Paystack availability", () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.CASH_ON_PICKUP_ALLOWED_EMAILS;
    process.env.PAYSTACK_ENABLED = "true";
    process.env.ONLINE_PAYMENT_REQUIRED = "true";
    assert.deepEqual(getPaymentAvailability().methods, { CASH: false, MOBILE_MONEY: false, CARD: false });
    process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
    assert.deepEqual(getPaymentAvailability().methods, { CASH: false, MOBILE_MONEY: true, CARD: true });
    process.env.CASH_ON_PICKUP_ALLOWED_EMAILS = "customer@example.test";
    assert.deepEqual(getPaymentAvailability({ customerEmail: "customer@example.test" }).methods, { CASH: true, MOBILE_MONEY: true, CARD: true });
    resetPaystackEnv();
  });

  it("allows server-validated electronic checkout only when its method is enabled", () => {
    const checkout = validateCheckoutPayload({
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customerName: "Ama Mensah",
      customerPhone: "0201234567",
      paymentMethod: "MOBILE_MONEY",
      lines: [{ menuItemId: "11111111-1111-4111-8111-111111111111", priceTier: 0, quantity: 1 }],
    }, { methods: { MOBILE_MONEY: true } });
    assert.equal(checkout.paymentMethod, "MOBILE_MONEY");
  });

  it("initializes hosted checkout with trusted subunits, GHS, callback and one channel", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
    let captured;
    const fetchDouble = async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/test", access_code: "test", reference: "KKP-test-reference-1" } }) };
    };
    const result = await initializePaystackTransaction({
      email: "customer@example.test",
      amount: "11000",
      currency: "GHS",
      reference: "KKP-test-reference-1",
      callback_url: "https://example.test/api/payments/paystack/callback",
      channels: ["card"],
    }, fetchDouble);
    assert.equal(captured.url, "https://api.paystack.co/transaction/initialize");
    assert.equal(captured.body.amount, "11000");
    assert.deepEqual(captured.body.channels, ["card"]);
    assert.equal(result.authorizationUrl, "https://checkout.paystack.com/test");
    assert.match(captured.options.headers.Authorization, /^Bearer /);
    resetPaystackEnv();
  });

  it("rejects a provider checkout URL outside the Paystack HTTPS domain", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
    await assert.rejects(
      initializePaystackTransaction({ reference: "KKP-test-reference-1" }, async () => ({
        ok: true,
        json: async () => ({ status: true, data: { authorization_url: "https://evilpaystack.com/test", reference: "KKP-test-reference-1" } }),
      })),
      /invalid checkout response/
    );
    resetPaystackEnv();
  });

  it("verifies transactions server-side and authenticates raw webhook bodies", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
    let url;
    const verified = await verifyPaystackTransaction("KKP-test-reference-1", async (requested) => {
      url = requested;
      return { ok: true, json: async () => ({ status: true, data: { status: "success" } }) };
    });
    assert.match(url, /transaction\/verify\/KKP-test-reference-1$/);
    assert.equal(verified.status, "success");
    const raw = JSON.stringify({ event: "charge.success" });
    const signature = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(raw).digest("hex");
    assert.equal(verifyPaystackWebhookSignature(raw, signature), true);
    assert.equal(verifyPaystackWebhookSignature(`${raw}x`, signature), false);
    resetPaystackEnv();
  });
});

describe("verified payment finalization and receipts", () => {
  const verified = { id: "90071992547409931234", reference: "KKP-test-reference-1", status: "success", amount: 11000, currency: "GHS", channel: "card", paid_at: "2026-08-30T12:00:00.000Z" };

  it("atomically marks payment paid, enters PENDING and issues one receipt", async () => {
    const { client, state } = paymentDouble();
    const first = await finalizeVerifiedPaystackPayment({ prismaClient: client, reference: verified.reference, verified, generateReceiptNumber: () => "KKR-20260830-ABC123" });
    const repeated = await finalizeVerifiedPaystackPayment({ prismaClient: client, reference: verified.reference, verified, generateReceiptNumber: () => "KKR-20260830-OTHER1" });
    assert.equal(state.payment.status, "PAID");
    assert.equal(state.order.status, "PENDING");
    assert.equal(state.attempt.providerTransactionId, "90071992547409931234");
    assert.equal(state.receiptCreates, 1);
    assert.equal(first.receiptNumber, "KKR-20260830-ABC123");
    assert.equal(repeated.idempotent, true);
  });

  it("rejects tampered amount, wrong currency, channel and provider reference", async () => {
    for (const changed of [
      { amount: 10999 },
      { currency: "NGN" },
      { channel: "mobile_money" },
      { reference: "KKP-other-reference-1" },
      { id: undefined },
    ]) {
      const { client, state } = paymentDouble();
      await assert.rejects(
        finalizeVerifiedPaystackPayment({ prismaClient: client, reference: state.attempt.providerRef, verified: { ...verified, ...changed } }),
        /verification|method/i
      );
      assert.equal(state.payment.status, "PENDING");
      assert.equal(state.receiptCreates, 0);
    }
  });

  it("creates printable, stable-format receipt numbers and a valid lightweight PDF", () => {
    assert.match(createReceiptNumber(new Date("2026-08-30T12:00:00Z")), /^KKR-20260830-[A-F0-9]{6}$/);
    const receipt = {
      receiptNumber: "KKR-20260830-ABC123",
      issuedAt: new Date("2026-08-30T12:00:00Z"),
      payment: {
        method: "CARD", providerRef: "KKP-test-reference-1", refund: null,
        order: { reference: "KK-TEST", customerNameSnapshot: "Ama", fulfillmentType: "PICKUP", totalMinor: 11000, currency: "GHS", items: [{ nameSnapshot: "Jollof", priceTier: 0, unitPriceMinor: 11000, quantity: 1, lineTotalMinor: 11000 }] },
      },
    };
    const pdf = buildReceiptPdf(receipt, () => "30 Aug 2026, 12:00 PM");
    assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
    assert.match(pdf.toString(), /KKR-20260830-ABC123/);
  });

  it("retries only a failed owned payment with a new attempt and no second Order", async () => {
    process.env.AUTH_URL = "http://localhost:3000";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_redacted";
    process.env.PAYSTACK_ENABLED = "true";
    const state = {
      order: {
        id: "order-1", reference: "KK-20260830-PAY001", userId: "customer-1",
        status: "AWAITING_PAYMENT", paymentStatus: "FAILED", paymentMethod: "CARD",
        payment: { id: "payment-1", status: "FAILED", amountMinor: 11000, currency: "GHS" },
        user: { email: "customer@example.test", role: "CUSTOMER" },
      },
      attempt: null,
      orderCreates: 0,
    };
    const transaction = {
      order: {
        findFirst: async () => state.order,
        update: async ({ data }) => Object.assign(state.order, data),
      },
      payment: { update: async ({ data }) => Object.assign(state.order.payment, data) },
      paymentAttempt: {
        count: async () => 1,
        create: async ({ data }) => { state.attempt = { id: "attempt-2", status: "CREATED", ...data }; return state.attempt; },
      },
    };
    const client = {
      ...transaction,
      $transaction: async (callback) => callback(transaction),
      paymentAttempt: {
        ...transaction.paymentAttempt,
        findUnique: async () => state.attempt,
        updateMany: async ({ data }) => { Object.assign(state.attempt, data); return { count: 1 }; },
        update: async ({ data }) => Object.assign(state.attempt, data),
      },
    };
    const result = await retryPaystackPayment({
      prismaClient: client,
      userId: "customer-1",
      orderReference: state.order.reference,
      assertOrderingOpen: async () => ({ acceptingOrders: true }),
      createReference: () => "KKP-retry-reference-2",
      initializeProvider: async (payload) => ({ authorizationUrl: "https://checkout.paystack.com/retry", reference: payload.reference }),
    });
    assert.equal(result.reference, "KKP-retry-reference-2");
    assert.equal(state.orderCreates, 0);
    assert.equal(state.order.payment.status, "PENDING");
    assert.equal(state.attempt.status, "PENDING");
    resetPaystackEnv();
  });

  it("keeps failed or abandoned payments outside the restaurant queue without a receipt", async () => {
    const { client, state } = paymentDouble();
    await markPaystackPaymentNotSuccessful({
      prismaClient: client,
      reference: state.attempt.providerRef,
      providerStatus: "abandoned",
    });
    assert.equal(state.attempt.status, "ABANDONED");
    assert.equal(state.payment.status, "FAILED");
    assert.equal(state.order.status, "AWAITING_PAYMENT");
    assert.equal(state.order.paymentStatus, "FAILED");
    assert.equal(state.receiptCreates, 0);
  });
});

describe("full Paystack refund policy", () => {
  it("requires a trusted bounded reason and rejects browser financial/role injection", () => {
    assert.deepEqual(prepareFullRefundRequest({ reason: "Item unavailable" }), { reason: "Item unavailable" });
    assert.throws(() => prepareFullRefundRequest({ reason: "Item unavailable", amountMinor: 1 }), /Trusted refund data/);
    assert.throws(() => prepareFullRefundRequest({ reason: "" }), /cancellation reason/);
  });

  it("lets ADMIN cancel and initiate one full provider refund, idempotently", async () => {
    const { client, state } = refundDouble("ADMIN");
    let calls = 0;
    const createProviderRefund = async (reference) => {
      calls += 1;
      assert.equal(reference, "KKP-test-reference-1");
      return { id: "refund-provider-1", status: "pending" };
    };
    const first = await initiateFullPaystackRefund({ prismaClient: client, adminUserId: "admin-1", orderReference: state.order.reference, reason: "Item unavailable", createProviderRefund });
    const repeated = await initiateFullPaystackRefund({ prismaClient: client, adminUserId: "admin-1", orderReference: state.order.reference, reason: "Item unavailable", createProviderRefund });
    assert.equal(state.order.status, "CANCELLED");
    assert.equal(first.refund.amountMinor, 11000);
    assert.equal(repeated.idempotent, true);
    assert.equal(calls, 1);
  });

  it("denies CHEF and normalizes official refund lifecycle events", async () => {
    const denied = refundDouble("CHEF");
    await assert.rejects(initiateFullPaystackRefund({ prismaClient: denied.client, adminUserId: "chef-1", orderReference: denied.state.order.reference, reason: "No stock", createProviderRefund: async () => ({}) }), (error) => error.status === 403);
    assert.equal(normalizeRefundStatus("processing"), "PROCESSING");
    assert.equal(normalizeRefundStatus("needs-attention"), "NEEDS_ATTENTION");
    assert.equal(normalizeRefundStatus("failed"), "FAILED");
  });

  it("processes signed refund outcomes idempotently and preserves the receipt", async () => {
    const { client, state } = refundDouble("ADMIN");
    state.order.payment.refund = { id: "refund-1", status: "PROCESSING", providerRefundId: null };
    state.order.payment.receipt = { receiptNumber: "KKR-20260830-ABC123" };
    const event = { type: "refund.processed", data: { id: "provider-refund-1", transaction: { reference: "KKP-test-reference-1" } } };
    const result = await processPaystackRefundEvent({ prismaClient: client, event });
    assert.equal(result.status, "PROCESSED");
    assert.equal(state.order.payment.status, "REFUNDED");
    assert.equal(state.order.payment.receipt.receiptNumber, "KKR-20260830-ABC123");
  });

  it("records a provider refund failure truthfully without claiming refunded", async () => {
    const { client, state } = refundDouble("ADMIN");
    await assert.rejects(
      initiateFullPaystackRefund({
        prismaClient: client,
        adminUserId: "admin-1",
        orderReference: state.order.reference,
        reason: "Item unavailable",
        createProviderRefund: async () => { throw new Error("provider unavailable"); },
      }),
      /provider unavailable/
    );
    assert.equal(state.order.status, "CANCELLED");
    assert.equal(state.order.payment.status, "PAID");
    assert.equal(state.order.payment.refund.status, "FAILED");
  });

  it("ignores an unknown refund reference without creating financial records", async () => {
    const result = await processPaystackRefundEvent({
      prismaClient: { payment: { findUnique: async () => null } },
      event: { type: "refund.processed", data: { transaction_reference: "KKP-unknown-reference" } },
    });
    assert.deepEqual(result, { ignored: true });
  });

  it("excludes pending/processed refunds from recognized revenue conservatively", () => {
    for (const refundStatus of ["PENDING", "PROCESSING", "PROCESSED"]) {
      const metrics = summarizeOrderMetrics({
        orders: [{ id: "order-1", status: "COMPLETED", total_minor: 11000 }],
        payments: [{ order_id: "order-1", method: "CARD", status: "PAID", amount_minor: 11000, refund_status: refundStatus }],
      });
      assert.equal(metrics.paidRevenueMinor, 0);
    }
  });
});

describe("payment route and secret boundaries", () => {
  it("scopes customer receipts to the authenticated owner and gives no receipt access to CHEF", async () => {
    const calls = [];
    const prismaClient = {
      receipt: {
        findFirst: async (query) => { calls.push(query); return { receiptNumber: "KKR-TEST" }; },
      },
    };
    await getAuthorizedReceipt({ prismaClient, reference: "KK-TEST", userId: "customer-a", role: "CUSTOMER" });
    assert.equal(calls[0].where.payment.order.userId, "customer-a");
    await getAuthorizedReceipt({ prismaClient, reference: "KK-TEST", userId: "admin-a", role: "ADMIN" });
    assert.equal(Object.hasOwn(calls[1].where.payment.order, "userId"), false);
    assert.equal(await getAuthorizedReceipt({ prismaClient, reference: "KK-TEST", userId: "chef-a", role: "CHEF" }), null);
    assert.equal(calls.length, 2);
  });

  it("keeps the secret server-only and requires shared verification/finalization", async () => {
    const [checkout, orderRoute, callback, webhook, schema] = await Promise.all([
      readFile("src/components/checkout/CheckoutForm.jsx", "utf8"),
      readFile("src/app/api/orders/route.js", "utf8"),
      readFile("src/app/api/payments/paystack/callback/route.js", "utf8"),
      readFile("src/app/api/payments/paystack/webhook/route.js", "utf8"),
      readFile("prisma/schema.prisma", "utf8"),
    ]);
    assert.doesNotMatch(checkout, /PAYSTACK_SECRET_KEY|sk_(test|live)_/);
    assert.doesNotMatch(orderRoute, /payload\.(paymentStatus|status|providerRef)/);
    assert.match(callback, /verifyPaystackTransaction/);
    assert.match(callback, /finalizeVerifiedPaystackPayment/);
    assert.doesNotMatch(callback, /searchParams\.get\("status"\)/);
    assert.match(webhook, /x-paystack-signature/);
    assert.match(webhook, /request\.text\(\)/);
    assert.match(schema, /receipt\s+Receipt\?/);
    assert.match(schema, /paymentId\s+String\s+@unique/);
  });
});
