import assert from "node:assert/strict";
import { describe, it } from "node:test";

const RUN = process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1";
const ROLLBACK = Symbol("PROMO_INTEGRATION_ROLLBACK");
const integrationDescribe = RUN ? describe : describe.skip;

integrationDescribe("Development Neon promo checkout", () => {
  it("creates a discounted Cash order and reservation transactionally without retaining fixtures", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    const { validateCheckoutPayload } = await import("../lib/orders/checkout-domain.js");
    const { createTrustedPickupOrder } = await import("../lib/orders/checkout-service.js");
    await verifyDevelopmentDatabase();

    let verified = false;
    try {
      await prisma.$transaction(async (transaction) => {
        const customer = await transaction.user.findFirst({
          where: { role: "CUSTOMER", email: { not: null }, profile: { isNot: null } },
          select: { id: true },
        });
        const item = await transaction.menuItem.findFirst({
          where: { active: true, available: true, category: { active: true } },
          select: { id: true, priceMinor: true },
        });
        assert.ok(customer && item, "Development needs one customer and menu item.");
        const promo = await transaction.promoCode.create({
          data: {
            code: `TEST${Date.now()}`,
            name: "Rollback-only promo acceptance",
            discountType: "PERCENTAGE",
            discountValue: 2000,
            active: true,
            totalUsageLimit: 1,
            perCustomerUsageLimit: 1,
          },
        });
        const checkout = validateCheckoutPayload({
          idempotencyKey: crypto.randomUUID(),
          customerName: "Promo Test",
          customerPhone: "0201234567",
          paymentMethod: "CASH",
          promoCode: promo.code,
          lines: [{ menuItemId: item.id, priceTier: 0, quantity: 1 }],
        }, { methods: { CASH: true } });
        const nestedClient = {
          ...transaction,
          $transaction: async (callback) => callback(transaction),
        };
        const order = await createTrustedPickupOrder({
          prismaClient: nestedClient,
          userId: customer.id,
          checkout,
          assertOrderingOpen: async () => true,
          resolvePaymentAvailability: () => ({ methods: { CASH: true } }),
        });
        const redemption = await transaction.promoRedemption.findUnique({
          where: { orderId: order.id },
        });
        assert.equal(order.discountMinor, Math.floor(order.subtotalMinor * 0.2));
        assert.equal(order.totalMinor, order.subtotalMinor - order.discountMinor);
        assert.equal(order.payment.amountMinor, order.totalMinor);
        assert.equal(redemption.status, "RESERVED");
        verified = true;
        throw ROLLBACK;
      }, { maxWait: 20_000, timeout: 60_000 });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
    assert.equal(verified, true);
  });
});
