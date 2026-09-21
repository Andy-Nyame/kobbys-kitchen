import {
  getPaystackPaymentMethods,
  PAYMENT_EXPIRED_REASON,
  PAYMENT_WINDOW_MS,
} from "./expiry-policy.js";
import { releasePromoReservationsForOrders } from "../promos/service.js";

export async function expireAbandonedPaystackOrders({
  prismaClient = null,
  now = new Date(),
  userId = null,
  reference = null,
} = {}) {
  const client = prismaClient || (await import("../prisma.js")).prisma;
  const cutoff = new Date(now.getTime() - PAYMENT_WINDOW_MS);
  const orderScope = {
    status: "AWAITING_PAYMENT",
    paymentMethod: { in: getPaystackPaymentMethods() },
    createdAt: { lte: cutoff },
    ...(userId ? { userId } : {}),
    ...(reference ? { reference } : {}),
  };

  return client.$transaction(async (transaction) => {
    const attempts = await transaction.paymentAttempt.updateMany({
      where: {
        status: { in: ["CREATED", "PENDING"] },
        payment: { order: orderScope },
      },
      data: {
        status: "ABANDONED",
        providerStatus: "expired",
        failureCode: PAYMENT_EXPIRED_REASON,
        failureMessage: "Payment window expired.",
        completedAt: now,
      },
    });
    const payments = await transaction.payment.updateMany({
      where: {
        status: "PENDING",
        paidAt: null,
        method: { in: getPaystackPaymentMethods() },
        order: orderScope,
      },
      data: { status: "FAILED", failedAt: now },
    });
    const orders = await transaction.order.updateMany({
      where: {
        ...orderScope,
        payment: { is: { status: "FAILED", paidAt: null } },
      },
      data: {
        status: "CANCELLED",
        paymentStatus: "FAILED",
        cancelledAt: now,
        cancellationReason: PAYMENT_EXPIRED_REASON,
      },
    });
    const expired = orders.count
      ? await transaction.order.findMany({
          where: {
            ...orderScope,
            status: "CANCELLED",
            cancellationReason: PAYMENT_EXPIRED_REASON,
          },
          select: { id: true, promoCodeId: true },
        })
      : [];
    await releasePromoReservationsForOrders(
      transaction,
      expired.filter((order) => order.promoCodeId).map((order) => order.id),
      now
    );
    return {
      expiredOrders: orders.count,
      failedPayments: payments.count,
      abandonedAttempts: attempts.count,
    };
  });
}
