import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { resolveEffectiveOrderingState } from "../lib/ordering/state.js";
import { validateCheckoutPayload } from "../lib/orders/checkout-domain.js";
import { createTrustedPickupOrder } from "../lib/orders/checkout-service.js";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1" ? describe : describe.skip;

class RollbackAcceptance extends Error {}

function resolveAcceptanceOrderingState(overrideMode) {
  const state = resolveEffectiveOrderingState({
    featureEnabled: true,
    setting: {
      emergencyPaused: false,
      overrideMode,
      overrideExpiresAt: null,
    },
    scheduleWindows: [],
    now: new Date("2026-08-29T12:00:00.000Z"),
  });

  if (!state.acceptingOrders) {
    const error = new Error("Kobby’s Kitchen is not accepting new online orders right now.");
    error.code = "ORDERING_CLOSED";
    throw error;
  }

  return state;
}

integrationDescribe("Development Neon trusted pickup checkout", () => {
  it("creates one atomic trusted order and rolls all disposable acceptance data back", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();

    const stableOrdersBefore = await prisma.order.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalMinor: true,
        updatedAt: true,
      },
    });
    const stablePaymentsBefore = await prisma.payment.findMany({
      orderBy: { id: "asc" },
      select: { id: true, status: true, amountMinor: true, updatedAt: true },
    });

    await assert.rejects(
      prisma.$transaction(
        async (transaction) => {
          const suffix = randomUUID().slice(0, 8);
          const customer = await transaction.user.create({
            data: {
              email: `checkout-${suffix}@example.test`,
              role: "CUSTOMER",
              profile: {
                create: {
                  displayName: "Checkout Acceptance",
                  phone: "+233201234567",
                },
              },
            },
          });
          const category = await transaction.menuCategory.create({
            data: {
              name: `Checkout ${suffix}`,
              slug: `checkout-${suffix}`,
              active: true,
            },
          });
          const item = await transaction.menuItem.create({
            data: {
              categoryId: category.id,
              slug: `checkout-meal-${suffix}`,
              name: "Checkout Acceptance Meal",
              description: "Disposable integration acceptance item.",
              priceMinor: 3000,
              priceStepMinor: 1000,
              currency: "GHS",
              available: true,
              active: true,
            },
          });
          const transactionClient = {
            $transaction: async (callback) => callback(transaction),
            order: transaction.order,
          };
          let overrideMode = "OPEN";
          const assertAcceptanceOrderingOpen = async () =>
            resolveAcceptanceOrderingState(overrideMode);
          const idempotencyKey = randomUUID();
          const checkout = validateCheckoutPayload({
            idempotencyKey,
            customerName: "Checkout Acceptance",
            customerPhone: "0201234567",
            note: "Call when the pickup is ready.",
            paymentMethod: "CASH",
            lines: [
              {
                menuItemId: item.id,
                priceTier: 0,
                quantity: 1,
                expectedUnitPriceMinor: 3000,
              },
              {
                menuItemId: item.id,
                priceTier: 1,
                quantity: 2,
                expectedUnitPriceMinor: 4000,
              },
            ],
          });
          const options = {
            prismaClient: transactionClient,
            userId: customer.id,
            checkout,
            assertOrderingOpen: assertAcceptanceOrderingOpen,
            createReference: () => `KK-20260829-${suffix.toUpperCase()}`,
          };

          const created = await createTrustedPickupOrder(options);
          assert.equal(created.idempotent, false);
          assert.equal(created.status, "PENDING");
          assert.equal(created.paymentStatus, "UNPAID");
          assert.equal(created.totalMinor, 11000);
          assert.deepEqual(created.items.map((line) => line.priceTier), [0, 1]);
          assert.equal(created.payment.amountMinor, 11000);
          assert.equal(await transaction.order.count({ where: { userId: customer.id } }), 1);
          assert.equal(
            await transaction.payment.count({ where: { order: { userId: customer.id } } }),
            1
          );

          const retry = await createTrustedPickupOrder(options);
          assert.equal(retry.id, created.id);
          assert.equal(retry.idempotent, true);
          assert.equal(await transaction.order.count({ where: { userId: customer.id } }), 1);

          overrideMode = "CLOSED";
          await assert.rejects(
            createTrustedPickupOrder({
              ...options,
              checkout: { ...checkout, idempotencyKey: randomUUID() },
            }),
            (error) => error.code === "ORDERING_CLOSED"
          );

          await transaction.menuItem.update({
            where: { id: item.id },
            data: { priceMinor: 9000, available: false },
          });
          overrideMode = "OPEN";
          await assert.rejects(
            createTrustedPickupOrder({
              ...options,
              checkout: {
                ...checkout,
                idempotencyKey: randomUUID(),
                lines: checkout.lines.map((line) => ({
                  ...line,
                  expectedUnitPriceMinor:
                    line.priceTier === 0 ? 9000 : 10000,
                })),
              },
            }),
            (error) => error.code === "ITEM_UNAVAILABLE"
          );
          const accepted = await transaction.order.findUnique({
            where: { id: created.id },
            include: { items: { orderBy: { createdAt: "asc" } }, payment: true },
          });
          assert.equal(accepted.totalMinor, 11000);
          assert.deepEqual(
            accepted.items.map((line) => line.unitPriceMinor),
            [3000, 4000]
          );
          assert.equal(accepted.payment.status, "UNPAID");

          const otherCustomer = await transaction.user.create({
            data: {
              email: `other-${suffix}@example.test`,
              role: "CUSTOMER",
              profile: { create: { displayName: "Other Customer" } },
            },
          });
          assert.equal(
            await transaction.order.count({
              where: { userId: otherCustomer.id, reference: created.reference },
            }),
            0
          );
          assert.ok(
            await transaction.order.findFirst({
              where: { reference: created.reference },
              select: { id: true },
            })
          );

          throw new RollbackAcceptance("Rollback disposable checkout acceptance data.");
        },
        { maxWait: 10_000, timeout: 30_000 }
      ),
      RollbackAcceptance
    );

    assert.deepEqual(
      await prisma.order.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalMinor: true,
          updatedAt: true,
        },
      }),
      stableOrdersBefore
    );
    assert.deepEqual(
      await prisma.payment.findMany({
        orderBy: { id: "asc" },
        select: { id: true, status: true, amountMinor: true, updatedAt: true },
      }),
      stablePaymentsBefore
    );
  });
});
