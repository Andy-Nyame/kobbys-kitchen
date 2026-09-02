import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateCheckoutPayload } from "../lib/orders/checkout-domain.js";
import { createTrustedPickupOrder } from "../lib/orders/checkout-service.js";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const allowCash = () => ({ methods: { CASH: true } });

function validCheckout(idempotencyKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
  return validateCheckoutPayload({
    idempotencyKey,
    customerName: "Ama Mensah",
    customerPhone: "0201234567",
    note: "Call when ready",
    paymentMethod: "CASH",
    lines: [
      { menuItemId: ITEM_ID, priceTier: 0, quantity: 1, expectedUnitPriceMinor: 3000 },
      { menuItemId: ITEM_ID, priceTier: 1, quantity: 2, expectedUnitPriceMinor: 4000 },
    ],
  });
}

function createFakePrisma() {
  const users = new Map([
    [CUSTOMER_ID, { id: CUSTOMER_ID, email: "ama@example.test", role: "CUSTOMER", profile: { id: "profile-1" } }],
    [SECOND_CUSTOMER_ID, { id: SECOND_CUSTOMER_ID, email: "esi@example.test", role: "CUSTOMER", profile: { id: "profile-2" } }],
    ["admin", { id: "admin", email: "admin@example.test", role: "ADMIN", profile: { id: "profile-admin" } }],
  ]);
  const orders = new Map();
  const state = { createCount: 0, captured: null, notifications: [] };
  const menuItems = [{
    id: ITEM_ID,
    name: "Indomie",
    priceMinor: 3000,
    priceStepMinor: 1000,
    currency: "GHS",
    available: true,
    active: true,
    category: { active: true },
  }];
  const transaction = {
    user: {
      findUnique: async ({ where }) => users.get(where.id) || null,
      findMany: async ({ where }) => [...users.values()].filter((user) => user.role === where.role),
    },
    notification: {
      createMany: async ({ data }) => {
        state.notifications.push(...data);
        return { count: data.length };
      },
    },
    menuItem: { findMany: async () => menuItems },
    order: {
      findUnique: async ({ where }) => {
        const key = where.userId_idempotencyKey;
        return orders.get(`${key.userId}:${key.idempotencyKey}`) || null;
      },
      create: async ({ data }) => {
        state.createCount += 1;
        state.captured = structuredClone(data);
        const created = {
          id: `order-${state.createCount}`,
          ...data,
          items: data.items.create,
          payment: data.payment.create,
        };
        orders.set(`${data.userId}:${data.idempotencyKey}`, created);
        return created;
      },
    },
  };
  return {
    state,
    users,
    transaction,
    $transaction: async (callback) => callback(transaction),
    order: transaction.order,
  };
}

describe("atomic trusted pickup order creation", () => {
  it("creates two different-tier snapshots, one unpaid Cash payment and an integer total", async () => {
    const prisma = createFakePrisma();
    const result = await createTrustedPickupOrder({
      prismaClient: prisma,
      userId: CUSTOMER_ID,
      checkout: validCheckout(),
      assertOrderingOpen: async () => ({ acceptingOrders: true }),
      createReference: () => "KK-20260829-A1B2C3D4",
      resolvePaymentAvailability: allowCash,
    });

    assert.equal(prisma.state.createCount, 1);
    assert.equal(result.reference, "KK-20260829-A1B2C3D4");
    assert.equal(result.status, "PENDING");
    assert.equal(result.paymentMethod, "CASH");
    assert.equal(result.paymentStatus, "UNPAID");
    assert.equal(result.totalMinor, 11000);
    assert.deepEqual(result.items.map((item) => item.priceTier), [0, 1]);
    assert.equal(prisma.state.captured.payment.create.status, "UNPAID");
    assert.equal(prisma.state.captured.payment.create.amountMinor, 11000);
  });

  it("returns the existing order for the same customer/key without creating a duplicate", async () => {
    const prisma = createFakePrisma();
    const options = {
      prismaClient: prisma,
      userId: CUSTOMER_ID,
      checkout: validCheckout(),
      assertOrderingOpen: async () => ({ acceptingOrders: true }),
      createReference: () => "KK-20260829-A1B2C3D4",
      resolvePaymentAvailability: allowCash,
    };
    const first = await createTrustedPickupOrder(options);
    const retry = await createTrustedPickupOrder({
      ...options,
      assertOrderingOpen: async () => {
        throw new Error("A successful retry must not be invalidated by later closure.");
      },
    });

    assert.equal(prisma.state.createCount, 1);
    assert.equal(retry.id, first.id);
    assert.equal(retry.idempotent, true);
  });

  it("allows another customer to use the same client key without unsafe collision", async () => {
    const prisma = createFakePrisma();
    const checkout = validCheckout();
    const shared = {
      prismaClient: prisma,
      checkout,
      assertOrderingOpen: async () => ({ acceptingOrders: true }),
      resolvePaymentAvailability: allowCash,
    };
    await createTrustedPickupOrder({ ...shared, userId: CUSTOMER_ID, createReference: () => "KK-20260829-11111111" });
    await createTrustedPickupOrder({ ...shared, userId: SECOND_CUSTOMER_ID, createReference: () => "KK-20260829-22222222" });
    assert.equal(prisma.state.createCount, 2);
  });

  it("fails before writes when ordering closes or catalogue validation fails", async () => {
    const prisma = createFakePrisma();
    await assert.rejects(
      createTrustedPickupOrder({
        prismaClient: prisma,
        userId: CUSTOMER_ID,
        checkout: validCheckout(),
        assertOrderingOpen: async () => {
          const error = new Error("closed");
          error.code = "ORDERING_CLOSED";
          throw error;
        },
        resolvePaymentAvailability: allowCash,
      }),
      (error) => error.code === "ORDERING_CLOSED"
    );
    assert.equal(prisma.state.createCount, 0);

    prisma.transaction.menuItem.findMany = async () => [];
    await assert.rejects(
      createTrustedPickupOrder({
        prismaClient: prisma,
        userId: CUSTOMER_ID,
        checkout: validCheckout(),
        assertOrderingOpen: async () => ({ acceptingOrders: true }),
        resolvePaymentAvailability: allowCash,
      }),
      (error) => error.code === "ITEM_REMOVED"
    );
    assert.equal(prisma.state.createCount, 0);
  });

  it("denies ADMIN and never accepts a browser-supplied customer identity", async () => {
    const prisma = createFakePrisma();
    await assert.rejects(
      createTrustedPickupOrder({
        prismaClient: prisma,
        userId: "admin",
        checkout: validCheckout(),
        assertOrderingOpen: async () => ({ acceptingOrders: true }),
      }),
      (error) => error.code === "CUSTOMER_REQUIRED"
    );
    assert.equal(prisma.state.createCount, 0);
  });

  it("rejects manipulated Cash submission using the trusted database email", async () => {
    const prisma = createFakePrisma();
    let checkedEmail = null;
    await assert.rejects(
      createTrustedPickupOrder({
        prismaClient: prisma,
        userId: CUSTOMER_ID,
        checkout: { ...validCheckout(), customerEmail: "allowlisted@example.test" },
        assertOrderingOpen: async () => ({ acceptingOrders: true }),
        resolvePaymentAvailability: ({ customerEmail }) => {
          checkedEmail = customerEmail;
          return { methods: { CASH: false } };
        },
      }),
      (error) => error.code === "PAYMENT_METHOD_UNAVAILABLE"
    );
    assert.equal(checkedEmail, "ama@example.test");
    assert.equal(prisma.state.createCount, 0);
  });
});
