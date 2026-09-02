import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { prepareAdminOrderMutation } from "../lib/orders/admin-domain.js";
import { executeAdminOrderMutation } from "../lib/orders/admin-mutations.js";
import { completePickup, markOrderReadyForPickup, recordCashReceived } from "../lib/pickup/service.js";
import {
  markNotificationRead,
  notifyAdminsOfNewOrder,
} from "../lib/notifications/service.js";

const integrationDescribe = process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1" ? describe : describe.skip;
class RollbackAcceptance extends Error {}

integrationDescribe("Development Neon operational order flow", () => {
  it("runs lifecycle and cancellation fixtures transactionally without changing stable orders or payments", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();
    const stableOrders = await prisma.order.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, paymentStatus: true, updatedAt: true } });
    const stablePayments = await prisma.payment.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, updatedAt: true } });

    await assert.rejects(prisma.$transaction(async (transaction) => {
      const suffix = randomUUID().slice(0, 8).toUpperCase();
      const admin = await transaction.user.create({ data: { email: `ops-admin-${suffix}@example.test`, role: "ADMIN", profile: { create: { displayName: "Operations Admin" } } } });
      const chef = await transaction.user.create({ data: { email: `ops-chef-${suffix}@example.test`, role: "CHEF", profile: { create: { displayName: "Operations Chef" } } } });
      const customer = await transaction.user.create({ data: { email: `ops-customer-${suffix}@example.test`, role: "CUSTOMER", profile: { create: { displayName: "Operations Customer" } } } });
      const createOrder = (reference) => transaction.order.create({ data: {
        reference,
        userId: customer.id,
        status: "PENDING",
        fulfillmentType: "PICKUP",
        paymentMethod: "CASH",
        paymentStatus: "UNPAID",
        customerNameSnapshot: "Operations Customer",
        customerEmailSnapshot: customer.email,
        customerPhoneSnapshot: "+233201234567",
        subtotalMinor: 2500,
        totalMinor: 2500,
        currency: "GHS",
        idempotencyKey: randomUUID(),
        payment: { create: { method: "CASH", status: "UNPAID", amountMinor: 2500, currency: "GHS" } },
      }, include: { payment: true } });
      const transactionClient = { $transaction: async (callback) => callback(transaction) };
      const lifecycle = await createOrder(`KK-20260829-${suffix}A`);
      await notifyAdminsOfNewOrder(transaction, lifecycle);
      await notifyAdminsOfNewOrder(transaction, lifecycle);
      for (const action of ["ACCEPT", "START_PREPARING"]) {
        await executeAdminOrderMutation({ prismaClient: transactionClient, adminUserId: admin.id, mutation: prepareAdminOrderMutation({ reference: lifecycle.reference, action }) });
      }
      const ready = await markOrderReadyForPickup({ prismaClient: transactionClient, actorId: admin.id, reference: lifecycle.reference, generateCode: () => "A123" });
      await recordCashReceived({ prismaClient: transactionClient, actorId: admin.id, code: ready.pickupCode });
      await completePickup({ prismaClient: transactionClient, actorId: admin.id, code: ready.pickupCode });
      const completed = await transaction.order.findUnique({ where: { id: lifecycle.id }, include: { payment: true, statusHistory: true } });
      assert.equal(completed.status, "COMPLETED");
      assert.equal(completed.paymentStatus, "PAID");
      assert.equal(completed.payment.status, "PAID");
      assert.equal(completed.pickupCode, null);
      assert.equal(completed.pickupCompletedById, admin.id);
      assert.equal(completed.statusHistory.length, 4);
      assert.ok(completed.statusHistory.every((event) => event.changedById === admin.id));

      const notifications = await transaction.notification.findMany({
        where: { userId: { in: [customer.id, admin.id, chef.id] } },
        orderBy: { createdAt: "asc" },
      });
      assert.deepEqual(
        notifications.filter((notification) => notification.userId === customer.id).map((notification) => notification.type).sort(),
        ["ORDER_ACCEPTED", "ORDER_COMPLETED", "ORDER_READY", "PAYMENT_CONFIRMED"]
      );
      assert.deepEqual(
        notifications.filter((notification) => notification.userId === admin.id).map((notification) => notification.type),
        ["NEW_ORDER"]
      );
      assert.deepEqual(
        notifications.filter((notification) => notification.userId === chef.id).map((notification) => notification.type),
        ["NEW_KITCHEN_ORDER"]
      );
      const customerNotification = notifications.find((notification) => notification.userId === customer.id);
      assert.equal((await markNotificationRead(transaction, admin.id, customerNotification.id)).count, 0);
      assert.equal((await markNotificationRead(transaction, customer.id, customerNotification.id)).count, 1);

      const cancelledFixture = await createOrder(`KK-20260829-${suffix}B`);
      await executeAdminOrderMutation({ prismaClient: transactionClient, adminUserId: admin.id, mutation: prepareAdminOrderMutation({ reference: cancelledFixture.reference, action: "CANCEL", cancellationReason: "Item unavailable" }) });
      const cancelled = await transaction.order.findUnique({ where: { id: cancelledFixture.id }, include: { payment: true, statusHistory: true } });
      assert.equal(cancelled.status, "CANCELLED");
      assert.equal(cancelled.cancellationReason, "Item unavailable");
      assert.equal(cancelled.payment.status, "UNPAID");
      assert.equal(cancelled.statusHistory.length, 1);
      throw new RollbackAcceptance("Rollback disposable operational fixtures.");
    }, { maxWait: 10_000, timeout: 30_000 }), RollbackAcceptance);

    assert.deepEqual(await prisma.order.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, paymentStatus: true, updatedAt: true } }), stableOrders);
    assert.deepEqual(await prisma.payment.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, updatedAt: true } }), stablePayments);
  });
});
