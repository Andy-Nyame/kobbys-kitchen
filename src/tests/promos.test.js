import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  assertPromoEligibility,
  calculatePromoDiscount,
  normalizePromoCode,
  PromoDomainError,
} from "../lib/promos/domain.js";
import {
  PROMO_ADMIN_ACTION,
  preparePromoMutation,
} from "../lib/promos/admin-validation.js";
import { executeAdminPromoMutation } from "../lib/promos/admin-mutations.js";
import {
  claimPromoForCheckout,
  createPromoReservation,
  previewPromo,
  redeemPromoReservation,
  releasePromoReservation,
} from "../lib/promos/service.js";
import { validateCheckoutPayload } from "../lib/orders/checkout-domain.js";
import { createTrustedPickupOrder } from "../lib/orders/checkout-service.js";

const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const PROMO_ID = "44444444-4444-4444-8444-444444444444";
const ORDER_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-09-21T12:00:00.000Z");

function promo(overrides = {}) {
  return {
    id: PROMO_ID,
    code: "KOBBY20",
    name: "Twenty percent off",
    discountType: "PERCENTAGE",
    discountValue: 2000,
    active: true,
    startAt: null,
    endAt: null,
    minimumSubtotalMinor: null,
    maximumDiscountMinor: null,
    totalUsageLimit: null,
    perCustomerUsageLimit: null,
    restrictedCustomerId: null,
    claimedUsageCount: 0,
    redeemedUsageCount: 0,
    ...overrides,
  };
}

function createPromoState(overrides = {}) {
  const state = {
    promo: promo(overrides),
    customerUsage: null,
    redemption: null,
  };
  const transaction = {
    user: {
      findUnique: async ({ where }) => {
        if (where.id === ADMIN_ID) return { id: ADMIN_ID, role: "ADMIN" };
        if (where.id === CUSTOMER_ID) return { id: CUSTOMER_ID, role: "CUSTOMER", email: "customer@example.test", profile: { id: "profile-1" } };
        return null;
      },
    },
    promoCode: {
      findUnique: async ({ where }) =>
        where.code === state.promo.code || where.id === state.promo.id
          ? state.promo
          : null,
      updateMany: async ({ where, data }) => {
        if (
          where.claimedUsageCount?.lt !== undefined &&
          state.promo.claimedUsageCount >= where.claimedUsageCount.lt
        ) return { count: 0 };
        if (data.claimedUsageCount?.increment) state.promo.claimedUsageCount += data.claimedUsageCount.increment;
        return { count: 1 };
      },
      update: async ({ data }) => {
        if (data.claimedUsageCount?.decrement) state.promo.claimedUsageCount -= data.claimedUsageCount.decrement;
        if (data.claimedUsageCount?.increment) state.promo.claimedUsageCount += data.claimedUsageCount.increment;
        if (data.redeemedUsageCount?.increment) state.promo.redeemedUsageCount += data.redeemedUsageCount.increment;
        return state.promo;
      },
      create: async ({ data }) => ({ id: PROMO_ID, ...data }),
    },
    promoCustomerUsage: {
      findUnique: async () => state.customerUsage,
      create: async ({ data }) => {
        state.customerUsage = { id: "usage-1", redeemedUsageCount: 0, ...data };
        return state.customerUsage;
      },
      updateMany: async ({ where, data }) => {
        if (where.claimedUsageCount?.lt !== undefined && state.customerUsage.claimedUsageCount >= where.claimedUsageCount.lt) return { count: 0 };
        state.customerUsage.claimedUsageCount += data.claimedUsageCount.increment;
        return { count: 1 };
      },
      update: async ({ data }) => {
        if (data.claimedUsageCount?.decrement) state.customerUsage.claimedUsageCount -= data.claimedUsageCount.decrement;
        if (data.claimedUsageCount?.increment) state.customerUsage.claimedUsageCount += data.claimedUsageCount.increment;
        if (data.redeemedUsageCount?.increment) state.customerUsage.redeemedUsageCount += data.redeemedUsageCount.increment;
        return state.customerUsage;
      },
    },
    promoRedemption: {
      create: async ({ data }) => {
        state.redemption = { id: "redemption-1", ...data };
        return state.redemption;
      },
      findUnique: async () => state.redemption,
      updateMany: async ({ where, data }) => {
        if (!state.redemption || state.redemption.status !== where.status) return { count: 0 };
        Object.assign(state.redemption, data);
        return { count: 1 };
      },
    },
  };
  return { state, transaction };
}

describe("promo calculation and eligibility", () => {
  it("calculates integer percentage, capped percentage, fixed and zero-floor discounts", () => {
    assert.deepEqual(calculatePromoDiscount({ discountType: "PERCENTAGE", discountValue: 2000, subtotalMinor: 10000 }), { discountMinor: 2000, totalMinor: 8000 });
    assert.deepEqual(calculatePromoDiscount({ discountType: "PERCENTAGE", discountValue: 2000, maximumDiscountMinor: 3000, subtotalMinor: 20000 }), { discountMinor: 3000, totalMinor: 17000 });
    assert.deepEqual(calculatePromoDiscount({ discountType: "FIXED_AMOUNT", discountValue: 1000, subtotalMinor: 5000 }), { discountMinor: 1000, totalMinor: 4000 });
    assert.deepEqual(calculatePromoDiscount({ discountType: "FIXED_AMOUNT", discountValue: 1000, subtotalMinor: 800 }), { discountMinor: 800, totalMinor: 0 });
  });

  it("normalizes case and whitespace and enforces schedule, minimum, usage and account restrictions", () => {
    assert.equal(normalizePromoCode(" Kobby20 "), "KOBBY20");
    assert.deepEqual(assertPromoEligibility(promo(), { subtotalMinor: 10000, userId: CUSTOMER_ID, now: NOW }), { discountMinor: 2000, totalMinor: 8000 });
    const cases = [
      [promo({ active: false }), "PROMO_INACTIVE"],
      [promo({ startAt: new Date("2026-09-22T00:00:00Z") }), "PROMO_NOT_STARTED"],
      [promo({ endAt: new Date("2026-09-20T00:00:00Z") }), "PROMO_EXPIRED"],
      [promo({ minimumSubtotalMinor: 10001 }), "PROMO_MINIMUM_NOT_MET"],
      [promo({ totalUsageLimit: 1, claimedUsageCount: 1 }), "PROMO_USAGE_LIMIT_REACHED"],
      [promo({ perCustomerUsageLimit: 1 }), "PROMO_CUSTOMER_LIMIT_REACHED", 1],
      [promo({ restrictedCustomerId: "another-user" }), "PROMO_ACCOUNT_RESTRICTED"],
    ];
    for (const [record, code, customerClaimedUsage = 0] of cases) {
      assert.throws(
        () => assertPromoEligibility(record, { subtotalMinor: 10000, userId: CUSTOMER_ID, now: NOW, customerClaimedUsage }),
        (error) => error instanceof PromoDomainError && error.code === code
      );
    }
  });
});

describe("promo reservation and accounting", () => {
  it("previews without consuming and atomically reserves one use for one order", async () => {
    const { state, transaction } = createPromoState({ totalUsageLimit: 1, perCustomerUsageLimit: 1 });
    const preview = await previewPromo({ prismaClient: transaction, userId: CUSTOMER_ID, code: " kobby20 ", subtotalMinor: 10000, now: NOW });
    assert.equal(preview.discountMinor, 2000);
    assert.equal(state.promo.claimedUsageCount, 0);
    const claim = await claimPromoForCheckout({ transaction, userId: CUSTOMER_ID, code: "KOBBY20", subtotalMinor: 10000, now: NOW });
    await createPromoReservation({ transaction, promoCodeId: claim.promo.id, orderId: ORDER_ID, userId: CUSTOMER_ID });
    assert.equal(state.promo.claimedUsageCount, 1);
    assert.equal(state.customerUsage.claimedUsageCount, 1);
    await assert.rejects(
      claimPromoForCheckout({ transaction, userId: CUSTOMER_ID, code: "KOBBY20", subtotalMinor: 10000, now: NOW }),
      (error) => error.code === "PROMO_USAGE_LIMIT_REACHED"
    );
  });

  it("finalizes a reservation once and releases an abandoned reservation without permanent use", async () => {
    const redeemed = createPromoState();
    await claimPromoForCheckout({ transaction: redeemed.transaction, userId: CUSTOMER_ID, code: "KOBBY20", subtotalMinor: 10000, now: NOW });
    await createPromoReservation({ transaction: redeemed.transaction, promoCodeId: PROMO_ID, orderId: ORDER_ID, userId: CUSTOMER_ID });
    assert.equal((await redeemPromoReservation(redeemed.transaction, ORDER_ID, NOW)).changed, true);
    assert.equal((await redeemPromoReservation(redeemed.transaction, ORDER_ID, NOW)).changed, false);
    assert.equal(redeemed.state.promo.redeemedUsageCount, 1);

    const released = createPromoState();
    await claimPromoForCheckout({ transaction: released.transaction, userId: CUSTOMER_ID, code: "KOBBY20", subtotalMinor: 10000, now: NOW });
    await createPromoReservation({ transaction: released.transaction, promoCodeId: PROMO_ID, orderId: ORDER_ID, userId: CUSTOMER_ID });
    assert.equal((await releasePromoReservation(released.transaction, ORDER_ID, NOW)).changed, true);
    assert.equal(released.state.promo.claimedUsageCount, 0);
    assert.equal(released.state.promo.redeemedUsageCount, 0);
  });

  it("reconciles a verified late payment after release without losing payment truth", async () => {
    const { state, transaction } = createPromoState();
    await claimPromoForCheckout({ transaction, userId: CUSTOMER_ID, code: "KOBBY20", subtotalMinor: 10000, now: NOW });
    await createPromoReservation({ transaction, promoCodeId: PROMO_ID, orderId: ORDER_ID, userId: CUSTOMER_ID });
    await releasePromoReservation(transaction, ORDER_ID, NOW);
    const result = await redeemPromoReservation(transaction, ORDER_ID, NOW, { allowReleased: true });
    assert.equal(result.changed, true);
    assert.equal(state.promo.claimedUsageCount, 1);
    assert.equal(state.promo.redeemedUsageCount, 1);
  });
});

describe("authoritative promo checkout", () => {
  it("revalidates current menu prices, snapshots one promo, and sets the discounted Payment amount", async () => {
    const { state, transaction } = createPromoState();
    const orders = new Map();
    transaction.user.findMany = async () => [];
    transaction.notification = { createMany: async () => ({ count: 0 }) };
    transaction.menuItem = { findMany: async () => [{ id: ITEM_ID, name: "Jollof", priceMinor: 10000, priceStepMinor: 1000, currency: "GHS", available: true, active: true, category: { active: true } }] };
    transaction.order = {
      findUnique: async ({ where }) => orders.get(`${where.userId_idempotencyKey.userId}:${where.userId_idempotencyKey.idempotencyKey}`) || null,
      create: async ({ data }) => {
        const order = { id: ORDER_ID, ...data, items: data.items.create, payment: { id: "payment-1", ...data.payment.create } };
        orders.set(`${data.userId}:${data.idempotencyKey}`, order);
        return order;
      },
    };
    const prismaClient = {
      ...transaction,
      $transaction: async (callback) => callback(transaction),
    };
    const checkout = validateCheckoutPayload({
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customerName: "Ama Mensah",
      customerPhone: "0201234567",
      paymentMethod: "CASH",
      promoCode: " kobby20 ",
      lines: [{ menuItemId: ITEM_ID, priceTier: 0, quantity: 1, expectedUnitPriceMinor: 10000 }],
    }, { methods: { CASH: true } });
    const order = await createTrustedPickupOrder({
      prismaClient,
      userId: CUSTOMER_ID,
      checkout,
      assertOrderingOpen: async () => true,
      createReference: () => "KK-20260921-PROMO001",
      resolvePaymentAvailability: () => ({ methods: { CASH: true } }),
    });
    assert.equal(order.subtotalMinor, 10000);
    assert.equal(order.discountMinor, 2000);
    assert.equal(order.totalMinor, 8000);
    assert.equal(order.payment.amountMinor, 8000);
    assert.equal(order.promoCode, "KOBBY20");
    assert.equal(state.redemption.orderId, ORDER_ID);
    assert.equal(state.redemption.status, "RESERVED");
  });

  it("rejects browser-owned discount totals and preserves one optional normalized code", () => {
    const payload = {
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customerName: "Ama Mensah",
      customerPhone: "0201234567",
      paymentMethod: "CASH",
      lines: [{ menuItemId: ITEM_ID, priceTier: 0, quantity: 1 }],
    };
    const availability = { methods: { CASH: true } };
    assert.equal(validateCheckoutPayload({ ...payload, promoCode: " kobby20 " }, availability).promoCode, "KOBBY20");
    assert.throws(() => validateCheckoutPayload({ ...payload, discountMinor: 999999 }, availability), /Trusted order totals/);
  });
});

describe("promo Admin and UI boundaries", () => {
  const input = {
    action: PROMO_ADMIN_ACTION.CREATE,
    code: " weekend20 ",
    name: "Weekend offer",
    discountType: "PERCENTAGE",
    discountValue: "20",
    active: true,
    startAt: "",
    endAt: "2026-09-26T23:59",
    minimumSubtotal: "50.00",
    maximumDiscount: "30.00",
    totalUsageLimit: "100",
    perCustomerUsageLimit: "1",
    restrictedCustomerId: CUSTOMER_ID,
  };

  it("normalizes Admin values to canonical code, basis points and integer pesewas", () => {
    const mutation = preparePromoMutation(input);
    assert.equal(mutation.data.code, "WEEKEND20");
    assert.equal(mutation.data.discountValue, 2000);
    assert.equal(mutation.data.minimumSubtotalMinor, 5000);
    assert.equal(mutation.data.maximumDiscountMinor, 3000);
  });

  it("rechecks ADMIN role and validates a selected existing CUSTOMER", async () => {
    const mutation = preparePromoMutation(input);
    const { transaction } = createPromoState();
    const prismaClient = { $transaction: async (callback) => callback(transaction) };
    await assert.rejects(executeAdminPromoMutation({ prismaClient, adminUserId: CUSTOMER_ID, mutation }), /Admin authorization/);
    const created = await executeAdminPromoMutation({ prismaClient, adminUserId: ADMIN_ID, mutation });
    assert.equal(created.code, "WEEKEND20");
  });

  it("ships one accessible cart field, an Admin route, and no challenge leaderboard", async () => {
    const [cart, checkout, checkoutService, adminPage, adminRoute, schema] = await Promise.all([
      readFile("src/components/cart/PromoCodeControl.jsx", "utf8"),
      readFile("src/components/checkout/CheckoutForm.jsx", "utf8"),
      readFile("src/lib/orders/checkout-service.js", "utf8"),
      readFile("src/app/admin/promos/page.js", "utf8"),
      readFile("src/app/api/admin/promos/route.js", "utf8"),
      readFile("prisma/schema.prisma", "utf8"),
    ]);
    assert.match(cart, /htmlFor="cart-promo-code"/);
    assert.match(cart, /One promo code may be used per order/);
    assert.match(adminPage, /requireAdmin\("\/admin\/promos"\)/);
    assert.match(adminRoute, /getAdminAuthorization/);
    assert.match(checkoutService, /totalMinor === 0 \? "PROMO"/);
    assert.match(checkoutService, /effectivePaymentMethod === "PROMO"/);
    assert.match(checkout, /paymentStatus === "PAID"[\s\S]*clearCart\(\)/);
    assert.doesNotMatch(schema, /CampaignLeaderboard|ChallengeEntry|winner/i);
  });
});
