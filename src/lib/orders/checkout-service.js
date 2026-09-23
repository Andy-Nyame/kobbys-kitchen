import {
  CheckoutDomainError,
  createOrderReference,
  deriveTrustedOrderLines,
} from "./checkout-domain.js";
import { getInitialOrderPaymentState } from "./domain.js";
import {
  assertPaymentMethodAvailable,
  createPaystackReference,
  isPaystackMethod,
  PAYSTACK_PROVIDER,
} from "../payments/domain.js";
import { notifyAdminsOfNewOrder } from "../notifications/service.js";
import { notifyPaymentConfirmed } from "../notifications/service.js";
import { issueReceipt } from "../payments/receipts.js";
import {
  claimPromoForCheckout,
  createPromoReservation,
  redeemPromoReservation,
} from "../promos/service.js";
import { PromoDomainError } from "../promos/domain.js";

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
    discountMinor: order.discountMinor,
    totalMinor: order.totalMinor,
    promoCode: order.promoCodeSnapshot,
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
  resolvePaymentAvailability,
}) {
  if (!prismaClient || typeof prismaClient.$transaction !== "function") {
    throw new TypeError("A Prisma transaction client is required.");
  }

  if (typeof assertOrderingOpen !== "function") {
    throw new TypeError("The authoritative ordering guard is required.");
  }

  if (typeof resolvePaymentAvailability !== "function") {
    throw new TypeError("The authoritative payment availability resolver is required.");
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
          await resolvePaymentAvailability({
            customerEmail: trustedUser.email,
            client: transaction,
          })
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
        const promoClaim = checkout.promoCode
          ? await claimPromoForCheckout({
              transaction,
              userId: trustedUser.id,
              code: checkout.promoCode,
              subtotalMinor: trustedCart.subtotalMinor,
            })
          : null;
        const totalMinor = promoClaim
          ? promoClaim.calculation.totalMinor
          : trustedCart.totalMinor;
        const effectivePaymentMethod =
          totalMinor === 0 ? "PROMO" : checkout.paymentMethod;
        const initialState = getInitialOrderPaymentState(effectivePaymentMethod);
        const paystackReference = isPaystackMethod(effectivePaymentMethod)
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
            paymentMethod: effectivePaymentMethod,
            paymentStatus: initialState.paymentStatus,
            customerNameSnapshot: checkout.customerName,
            customerEmailSnapshot: trustedUser.email,
            customerPhoneSnapshot: checkout.customerPhone,
            note: checkout.note,
            subtotalMinor: trustedCart.subtotalMinor,
            discountMinor: promoClaim?.calculation.discountMinor || 0,
            totalMinor,
            ...(promoClaim ? promoClaim.snapshot : {}),
            currency: "GHS",
            idempotencyKey: checkout.idempotencyKey,
            items: {
              create: trustedCart.lines,
            },
            payment: {
              create: {
                method: effectivePaymentMethod,
                status: initialState.paymentStatus,
                amountMinor: totalMinor,
                currency: "GHS",
                ...(paystackReference
                  ? {
                      provider: PAYSTACK_PROVIDER,
                      attempts: {
                        create: {
                          provider: PAYSTACK_PROVIDER,
                          status: "CREATED",
                          amountMinor: totalMinor,
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

        if (promoClaim) {
          await createPromoReservation({
            transaction,
            promoCodeId: promoClaim.promo.id,
            orderId: order.id,
            userId: trustedUser.id,
          });
        }

        if (effectivePaymentMethod === "PROMO") {
          await redeemPromoReservation(transaction, order.id);
          await issueReceipt({ client: transaction, paymentId: order.payment.id });
          await notifyPaymentConfirmed(transaction, order);
          await notifyAdminsOfNewOrder(transaction, order);
        } else if (effectivePaymentMethod === "CASH") {
          await notifyAdminsOfNewOrder(transaction, order);
        }

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
      throw new PromoDomainError(
        "PROMO_USAGE_CONFLICT",
        "This promo changed while your order was being placed. Try again.",
        409
      );
    }
    if (error?.code === "P2034") {
      throw new PromoDomainError(
        "PROMO_USAGE_CONFLICT",
        "This promo changed while your order was being placed. Try again.",
        409
      );
    }

    throw error;
  }
}
