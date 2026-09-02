import {
  getPaystackPaymentMethods,
  PAYMENT_EXPIRED_REASON,
  PAYMENT_WINDOW_MS,
} from "./expiry-policy.js";

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

  const [attempts, payments, orders] = await client.$transaction([
    client.paymentAttempt.updateMany({
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
    }),
    client.payment.updateMany({
      where: {
        status: "PENDING",
        paidAt: null,
        method: { in: getPaystackPaymentMethods() },
        order: orderScope,
      },
      data: { status: "FAILED", failedAt: now },
    }),
    client.order.updateMany({
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
    }),
  ]);

  return {
    expiredOrders: orders.count,
    failedPayments: payments.count,
    abandonedAttempts: attempts.count,
  };
}
