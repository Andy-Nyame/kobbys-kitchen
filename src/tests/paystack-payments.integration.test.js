import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { validateCheckoutPayload } from "../lib/orders/checkout-domain.js";
import { createTrustedPickupOrder } from "../lib/orders/checkout-service.js";
import {
  finalizeVerifiedPaystackPayment,
  initiateFullPaystackRefund,
  processPaystackRefundEvent,
} from "../lib/payments/service.js";

const integrationDescribe = process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1" ? describe : describe.skip;
class RollbackAcceptance extends Error {}

integrationDescribe("Development Neon Paystack/receipt/refund acceptance", () => {
  it("finalizes and refunds one disposable electronic order without retaining data", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();
    const before = {
      orders: await prisma.order.count(),
      payments: await prisma.payment.count(),
      attempts: await prisma.paymentAttempt.count(),
      receipts: await prisma.receipt.count(),
      refunds: await prisma.refund.count(),
    };

    await assert.rejects(prisma.$transaction(async (transaction) => {
      const suffix = randomUUID().slice(0, 8);
      const customer = await transaction.user.create({
        data: { email: `paystack-${suffix}@example.test`, role: "CUSTOMER", profile: { create: { displayName: "Paystack Acceptance", phone: "+233201234567" } } },
      });
      const admin = await transaction.user.create({
        data: { email: `paystack-admin-${suffix}@example.test`, role: "ADMIN" },
      });
      const category = await transaction.menuCategory.create({ data: { name: `Paystack ${suffix}`, slug: `paystack-${suffix}`, active: true } });
      const item = await transaction.menuItem.create({
        data: { categoryId: category.id, slug: `paystack-item-${suffix}`, name: "Paystack Meal", description: "Disposable payment fixture", priceMinor: 11000, priceStepMinor: 1000, currency: "GHS", available: true, active: true },
      });
      const client = {
        user: transaction.user,
        menuItem: transaction.menuItem,
        order: transaction.order,
        payment: transaction.payment,
        paymentAttempt: transaction.paymentAttempt,
        receipt: transaction.receipt,
        refund: transaction.refund,
        orderStatusHistory: transaction.orderStatusHistory,
        $transaction: async (value) => typeof value === "function" ? value(transaction) : Promise.all(value),
      };
      const checkout = validateCheckoutPayload({
        idempotencyKey: randomUUID(),
        customerName: "Paystack Acceptance",
        customerPhone: "0201234567",
        paymentMethod: "CARD",
        lines: [{ menuItemId: item.id, priceTier: 0, quantity: 1, expectedUnitPriceMinor: 11000 }],
      }, { methods: { CARD: true } });
      const created = await createTrustedPickupOrder({
        prismaClient: client,
        userId: customer.id,
        checkout,
        assertOrderingOpen: async () => ({ acceptingOrders: true }),
        createReference: () => `KK-20260830-${suffix.toUpperCase()}`,
        createProviderReference: () => `KKP-${suffix}-acceptance`,
      });
      assert.equal(created.status, "AWAITING_PAYMENT");
      assert.equal(created.paymentStatus, "PENDING");
      assert.equal(created.payment.attempts.length, 1);

      const reference = created.payment.attempts[0].providerRef;
      const verified = { id: "90071992547409931234", reference, status: "success", amount: 11000, currency: "GHS", channel: "card", paid_at: "2026-08-30T12:00:00Z" };
      const finalized = await finalizeVerifiedPaystackPayment({ prismaClient: client, reference, verified, generateReceiptNumber: () => `KKR-20260830-${suffix.slice(0, 6).toUpperCase()}` });
      const repeated = await finalizeVerifiedPaystackPayment({ prismaClient: client, reference, verified });
      assert.equal(finalized.receiptNumber, repeated.receiptNumber);
      assert.equal(await transaction.receipt.count({ where: { paymentId: created.payment.id } }), 1);
      const paid = await transaction.order.findUnique({ where: { id: created.id }, include: { payment: true } });
      assert.equal(paid.status, "PENDING");
      assert.equal(paid.payment.status, "PAID");

      const refund = await initiateFullPaystackRefund({
        prismaClient: client,
        adminUserId: admin.id,
        orderReference: created.reference,
        reason: "Acceptance refund",
        createProviderRefund: async () => ({ id: `refund-${suffix}`, status: "pending" }),
      });
      assert.equal(refund.refund.status, "PENDING");
      await processPaystackRefundEvent({
        prismaClient: client,
        event: { type: "refund.processed", data: { refund_reference: `refund-${suffix}`, transaction_reference: reference } },
      });
      const refunded = await transaction.payment.findUnique({ where: { id: created.payment.id }, include: { receipt: true, refund: true } });
      assert.equal(refunded.status, "REFUNDED");
      assert.equal(refunded.refund.status, "PROCESSED");
      assert.ok(refunded.receipt);
      throw new RollbackAcceptance("Rollback Paystack acceptance data");
    }, { maxWait: 10_000, timeout: 30_000 }), RollbackAcceptance);

    assert.deepEqual({
      orders: await prisma.order.count(),
      payments: await prisma.payment.count(),
      attempts: await prisma.paymentAttempt.count(),
      receipts: await prisma.receipt.count(),
      refunds: await prisma.refund.count(),
    }, before);
  });
});
