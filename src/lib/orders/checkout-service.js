import {
  CheckoutDomainError,
  createOrderReference,
  deriveTrustedOrderLines,
} from "./checkout-domain.js";
import { getInitialOrderPaymentState } from "./domain.js";
import {
  assertPaymentMethodAvailable,
  createPaystackReference,
  getPaymentAvailability,
  isPaystackMethod,
  PAYSTACK_PROVIDER,
} from "../payments/domain.js";

const orderResultInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      nameSnapshot: true,
      priceTier: true,
      unitPriceMinor: true,
      quantity: true,
      lineTotalMinor: true,
    },
  },
  payment: {
    select: {
      method: true,
      status: true,
      amountMinor: true,
      currency: true,
      id: true,
      provider: true,
      providerRef: true,
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          providerRef: true,
          authorizationUrl: true,
        },
      },
    },
  },
};

function presentOrderResult(order, idempotent) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    customerName: order.customerNameSnapshot,
    customerEmail: order.customerEmailSnapshot,
    customerPhone: order.customerPhoneSnapshot,
    note: order.note,
    subtotalMinor: order.subtotalMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    createdAt: order.createdAt,
    cancellationReason: order.cancellationReason,
    items: order.items,
    payment: order.payment,
    idempotent,
  };
}

async function findIdempotentOrder(client, userId, idempotencyKey) {
  return client.order.findUnique({
    where: {
      userId_idempotencyKey: { userId, idempotencyKey },
    },
    include: orderResultInclude,
  });
}

export async function createTrustedPickupOrder({
  prismaClient,
  userId,
  checkout,
  assertOrderingOpen,
  createReference = createOrderReference,
  createProviderReference = createPaystackReference,
  resolvePaymentAvailability = getPaymentAvailability,
}) {
  if (!prismaClient || typeof prismaClient.$transaction !== "function") {
    throw new TypeError("A Prisma transaction client is required.");
  }

  if (typeof assertOrderingOpen !== "function") {
    throw new TypeError("The authoritative ordering guard is required.");
  }

  try {
    return await prismaClient.$transaction(
      async (transaction) => {
        const trustedUser = await transaction.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { id: true } },
          },
        });

        if (!trustedUser) {
          throw new CheckoutDomainError(
            "AUTHENTICATION_REQUIRED",
            "Sign in before placing an order."
          );
        }

        if (trustedUser.role !== "CUSTOMER") {
          throw new CheckoutDomainError(
            "CUSTOMER_REQUIRED",
            "Only customer accounts can place pickup orders."
          );
        }

        if (!trustedUser.profile || !trustedUser.email) {
          throw new CheckoutDomainError(
            "PROFILE_REQUIRED",
            "Complete your customer profile before placing an order."
          );
        }

        const existing = await findIdempotentOrder(
          transaction,
          trustedUser.id,
          checkout.idempotencyKey
        );

        if (existing) {
          return presentOrderResult(existing, true);
        }

        assertPaymentMethodAvailable(
          checkout.paymentMethod,
          resolvePaymentAvailability({ customerEmail: trustedUser.email })
        );

        await assertOrderingOpen({ client: transaction });

        const menuItemIds = [...new Set(checkout.lines.map((line) => line.menuItemId))];
        const menuItems = await transaction.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: {
            id: true,
            name: true,
            priceMinor: true,
            priceStepMinor: true,
            currency: true,
            available: true,
            active: true,
            category: { select: { active: true } },
          },
        });
        const trustedCart = deriveTrustedOrderLines(checkout.lines, menuItems);
        const initialState = getInitialOrderPaymentState(checkout.paymentMethod);
        const paystackReference = isPaystackMethod(checkout.paymentMethod)
          ? createProviderReference()
          : null;

        // Availability controls new submissions only. This transaction never
        // revisits, cancels, or mutates an already accepted Order.
        const order = await transaction.order.create({
          data: {
            reference: createReference(),
            userId: trustedUser.id,
            status: initialState.orderStatus,
            fulfillmentType: "PICKUP",
            paymentMethod: checkout.paymentMethod,
            paymentStatus: initialState.paymentStatus,
            customerNameSnapshot: checkout.customerName,
            customerEmailSnapshot: trustedUser.email,
            customerPhoneSnapshot: checkout.customerPhone,
            note: checkout.note,
            subtotalMinor: trustedCart.subtotalMinor,
            totalMinor: trustedCart.totalMinor,
            currency: "GHS",
            idempotencyKey: checkout.idempotencyKey,
            items: {
              create: trustedCart.lines,
            },
            payment: {
              create: {
                method: checkout.paymentMethod,
                status: initialState.paymentStatus,
                amountMinor: trustedCart.totalMinor,
                currency: "GHS",
                ...(paystackReference
                  ? {
                      provider: PAYSTACK_PROVIDER,
                      attempts: {
                        create: {
                          provider: PAYSTACK_PROVIDER,
                          status: "CREATED",
                          amountMinor: trustedCart.totalMinor,
                          currency: "GHS",
                          providerRef: paystackReference,
                          idempotencyKey: `${checkout.idempotencyKey}:1`,
                        },
                      },
                    }
                  : {}),
              },
            },
          },
          include: orderResultInclude,
        });

        return presentOrderResult(order, false);
      },
      {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 20_000,
      }
    );
  } catch (error) {
    if (error?.code === "P2002") {
      const existing = await findIdempotentOrder(
        prismaClient,
        userId,
        checkout.idempotencyKey
      );

      if (existing) {
        return presentOrderResult(existing, true);
      }
    }

    throw error;
  }
}
