import {
  assertPaymentMethodAvailable,
  createPaystackReference,
  createReceiptNumber,
  getPaymentAvailability,
  getSafeSiteUrl,
  isPaystackMethod,
  normalizeRefundStatus,
  PAYSTACK_CHANNEL_BY_METHOD,
  PAYSTACK_PROVIDER,
  PaymentDomainError,
  REFUND_STATUS,
} from "./domain.js";
import {
  createPaystackRefund,
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from "./providers/paystack.js";
import { expireAbandonedPaystackOrders } from "./expiry.js";
import {
  isPaymentExpiredOrder,
  isWithinPaymentWindow,
  LATE_PAYSTACK_PAYMENT_REASON,
  PAYMENT_EXPIRED_MESSAGE,
  PAYMENT_EXPIRED_REASON,
  requiresLatePaymentReconciliation,
} from "./expiry-policy.js";
import { issueReceipt } from "./receipts.js";
import {
  notifyAdminsOfNewOrder,
  notifyOrderCancelled,
  notifyPaymentConfirmed,
  notifyPaymentReconciliationRequired,
} from "../notifications/service.js";

function assertVerifiedTransaction(attempt, verified) {
  if (!verified || verified.reference !== attempt.providerRef) {
    throw new PaymentDomainError("PAYMENT_REFERENCE_MISMATCH", "Payment verification failed.");
  }
  if (verified.status !== "success") {
    throw new PaymentDomainError("PAYMENT_NOT_SUCCESSFUL", "Payment was not completed.");
  }
  if (verified.amount !== attempt.amountMinor) {
    throw new PaymentDomainError("PAYMENT_AMOUNT_MISMATCH", "Payment amount verification failed.");
  }
  if (verified.currency !== "GHS" || attempt.currency !== "GHS") {
    throw new PaymentDomainError("PAYMENT_CURRENCY_MISMATCH", "Payment currency verification failed.");
  }
  if (verified.id == null || !/^\d+$/.test(String(verified.id))) {
    throw new PaymentDomainError("PAYMENT_TRANSACTION_INVALID", "Payment transaction verification failed.");
  }
  const expectedChannel = PAYSTACK_CHANNEL_BY_METHOD[attempt.payment.method];
  if (expectedChannel && verified.channel !== expectedChannel) {
    throw new PaymentDomainError("PAYMENT_CHANNEL_MISMATCH", "Payment method verification failed.");
  }
}

async function loadAttempt(prismaClient, reference) {
  return prismaClient.paymentAttempt.findUnique({
    where: { providerRef: reference },
    include: {
      payment: {
        include: {
          receipt: true,
          order: {
            select: {
              id: true,
              reference: true,
              userId: true,
              status: true,
              paymentStatus: true,
              cancellationReason: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

export async function initializePaystackAttempt({
  prismaClient,
  attemptId,
  customerEmail,
  orderReference,
  method,
  initializeProvider = initializePaystackTransaction,
  now = new Date(),
}) {
  const attempt = await prismaClient.paymentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      amountMinor: true,
      currency: true,
      providerRef: true,
      authorizationUrl: true,
    },
  });
  if (!attempt?.providerRef || !isPaystackMethod(method)) {
    throw new PaymentDomainError("PAYMENT_ATTEMPT_INVALID", "Payment could not be initialized.");
  }
  if (attempt.status === "PENDING" && attempt.authorizationUrl) {
    return { authorizationUrl: attempt.authorizationUrl, reference: attempt.providerRef, idempotent: true };
  }
  if (attempt.status !== "CREATED") {
    throw new PaymentDomainError("PAYMENT_ATTEMPT_UNAVAILABLE", "Start a new payment attempt.");
  }

  const claimed = await prismaClient.paymentAttempt.updateMany({
    where: { id: attempt.id, status: "CREATED" },
    data: { status: "PENDING", initializedAt: now },
  });
  if (claimed.count !== 1) {
    throw new PaymentDomainError("PAYMENT_ATTEMPT_BUSY", "Payment is already being initialized.");
  }

  try {
    const initialized = await initializeProvider({
      email: customerEmail,
      amount: String(attempt.amountMinor),
      currency: "GHS",
      reference: attempt.providerRef,
      callback_url: `${getSafeSiteUrl()}/api/payments/paystack/callback`,
      channels: [PAYSTACK_CHANNEL_BY_METHOD[method]],
      metadata: JSON.stringify({ orderReference }),
    });
    await prismaClient.paymentAttempt.update({
      where: { id: attempt.id },
      data: { authorizationUrl: initialized.authorizationUrl, providerStatus: "initialized" },
    });
    return { ...initialized, idempotent: false };
  } catch (error) {
    await prismaClient.paymentAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: {
        status: "FAILED",
        failureCode: error?.code || "PAYSTACK_INITIALIZE_FAILED",
        failureMessage: "Payment initialization failed.",
        completedAt: now,
      },
    });
    throw error;
  }
}

export async function initializeNewOrderPayment({ prismaClient, order }) {
  if (!isPaystackMethod(order.paymentMethod)) return null;
  if (order.payment?.status === "PAID") return null;
  const now = new Date();
  if (!isWithinPaymentWindow(order.createdAt, now)) {
    await expireAbandonedPaystackOrders({
      prismaClient,
      now,
      userId: order.userId,
      reference: order.reference,
    });
    throw new PaymentDomainError("PAYMENT_EXPIRED", PAYMENT_EXPIRED_MESSAGE, 409);
  }
  const attempt = order.payment?.attempts?.[0];
  if (!attempt) {
    throw new PaymentDomainError("PAYMENT_ATTEMPT_MISSING", "Payment could not be initialized.");
  }
  try {
    return await initializePaystackAttempt({
      prismaClient,
      attemptId: attempt.id,
      customerEmail: order.customerEmail,
      orderReference: order.reference,
      method: order.paymentMethod,
    });
  } catch (error) {
    if (error?.code !== "PAYMENT_ATTEMPT_BUSY") {
      await prismaClient.$transaction([
        prismaClient.payment.updateMany({
          where: { id: order.payment.id, status: "PENDING" },
          data: { status: "FAILED", failedAt: new Date() },
        }),
        prismaClient.order.updateMany({
          where: { id: order.id, status: "AWAITING_PAYMENT", paymentStatus: "PENDING" },
          data: { paymentStatus: "FAILED" },
        }),
      ]);
    }
    throw error;
  }
}

export async function retryPaystackPayment({
  prismaClient,
  userId,
  orderReference,
  createReference = createPaystackReference,
  initializeProvider = initializePaystackTransaction,
  expireOrders = expireAbandonedPaystackOrders,
  now = new Date(),
}) {
  await expireOrders({
    prismaClient,
    now,
    userId,
    reference: orderReference,
  });
  const prepared = await prismaClient.$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: { reference: orderReference, userId },
      include: {
        payment: {
          include: {
            attempts: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        },
        user: { select: { email: true, role: true } },
      },
    });
    if (!order || order.user.role !== "CUSTOMER") {
      throw new PaymentDomainError("ORDER_NOT_FOUND", "Order not found.", 404);
    }
    if (isPaymentExpiredOrder(order)) {
      throw new PaymentDomainError("PAYMENT_EXPIRED", PAYMENT_EXPIRED_MESSAGE, 409);
    }
    const failedPayment =
      order.payment?.status === "FAILED" && order.paymentStatus === "FAILED";
    const interruptedRetry =
      order.payment?.status === "PENDING" &&
      order.paymentStatus === "PENDING" &&
      order.payment.attempts[0]?.status === "FAILED";
    if (
      order.status !== "AWAITING_PAYMENT" ||
      !isPaystackMethod(order.paymentMethod) ||
      (!failedPayment && !interruptedRetry)
    ) {
      throw new PaymentDomainError("PAYMENT_RETRY_UNAVAILABLE", "This payment cannot be retried.");
    }
    assertPaymentMethodAvailable(order.paymentMethod, getPaymentAvailability());
    const attemptCount = await transaction.paymentAttempt.count({ where: { paymentId: order.payment.id } });
    const providerRef = createReference();
    const attempt = await transaction.paymentAttempt.create({
      data: {
        paymentId: order.payment.id,
        provider: PAYSTACK_PROVIDER,
        status: "CREATED",
        amountMinor: order.payment.amountMinor,
        currency: order.payment.currency,
        providerRef,
        idempotencyKey: `${order.id}:${attemptCount + 1}:${providerRef}`,
      },
    });
    await transaction.payment.update({
      where: { id: order.payment.id },
      data: { status: "PENDING", failedAt: null },
    });
    await transaction.order.update({
      where: { id: order.id },
      data: { paymentStatus: "PENDING" },
    });
    return { attempt, order, email: order.user.email };
  });
  try {
    return await initializePaystackAttempt({
      prismaClient,
      attemptId: prepared.attempt.id,
      customerEmail: prepared.email,
      orderReference: prepared.order.reference,
      method: prepared.order.paymentMethod,
      initializeProvider,
      now,
    });
  } catch (error) {
    if (error?.code !== "PAYMENT_ATTEMPT_BUSY") {
      const failedAt = new Date();
      await prismaClient.$transaction([
        prismaClient.payment.updateMany({
          where: { id: prepared.order.payment.id, status: "PENDING" },
          data: { status: "FAILED", failedAt },
        }),
        prismaClient.order.updateMany({
          where: {
            id: prepared.order.id,
            status: "AWAITING_PAYMENT",
            paymentStatus: "PENDING",
          },
          data: { paymentStatus: "FAILED" },
        }),
      ]);
    }
    throw error;
  }
}

export async function finalizeVerifiedPaystackPayment({
  prismaClient,
  reference,
  verified,
  now = new Date(),
  generateReceiptNumber = createReceiptNumber,
}) {
  const initial = await loadAttempt(prismaClient, reference);
  if (!initial || initial.provider !== PAYSTACK_PROVIDER) {
    throw new PaymentDomainError("PAYMENT_REFERENCE_UNKNOWN", "Payment reference was not found.", 404);
  }
  assertVerifiedTransaction(initial, verified);

  try {
    return await prismaClient.$transaction(async (transaction) => {
      const attempt = await transaction.paymentAttempt.findUnique({
        where: { id: initial.id },
        include: { payment: { include: { receipt: true, order: true } } },
      });
      assertVerifiedTransaction(attempt, verified);
      if (attempt.payment.status === "PAID" && attempt.payment.receipt) {
        return {
          orderReference: attempt.payment.order.reference,
          receiptNumber: attempt.payment.receipt.receiptNumber,
          idempotent: true,
          requiresAdminReconciliation: requiresLatePaymentReconciliation(
            attempt.payment.order
          ),
        };
      }

      const paidAt = verified.paid_at ? new Date(verified.paid_at) : now;
      if (!Number.isFinite(paidAt.getTime())) {
        throw new PaymentDomainError(
          "PAYMENT_TRANSACTION_INVALID",
          "Payment transaction verification failed."
        );
      }
      const withinPaymentWindow = isWithinPaymentWindow(
        attempt.payment.order.createdAt,
        paidAt
      );
      const canEnterOperations =
        withinPaymentWindow &&
        (attempt.payment.order.status === "AWAITING_PAYMENT" ||
          isPaymentExpiredOrder(attempt.payment.order));
      const requiresAdminReconciliation = !canEnterOperations;

      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUCCEEDED",
          providerStatus: verified.status,
          providerTransactionId: String(verified.id),
          completedAt: now,
          failureCode: null,
          failureMessage: null,
        },
      });
      await transaction.payment.update({
        where: { id: attempt.payment.id },
        data: {
          status: "PAID",
          provider: PAYSTACK_PROVIDER,
          providerRef: reference,
          paidAt,
          failedAt: null,
        },
      });
      if (canEnterOperations) {
        await transaction.order.updateMany({
          where: {
            id: attempt.payment.order.id,
            OR: [
              { status: "AWAITING_PAYMENT" },
              {
                status: "CANCELLED",
                cancellationReason: {
                  in: [PAYMENT_EXPIRED_REASON, LATE_PAYSTACK_PAYMENT_REASON],
                },
              },
            ],
          },
          data: {
            status: "PENDING",
            paymentStatus: "PAID",
            cancelledAt: null,
            cancelledById: null,
            cancellationReason: null,
          },
        });
        await notifyPaymentConfirmed(transaction, attempt.payment.order);
        await notifyAdminsOfNewOrder(transaction, attempt.payment.order);
      } else {
        await transaction.order.updateMany({
          where: {
            id: attempt.payment.order.id,
            OR: [
              { status: "AWAITING_PAYMENT" },
              {
                status: "CANCELLED",
                cancellationReason: {
                  in: [PAYMENT_EXPIRED_REASON, LATE_PAYSTACK_PAYMENT_REASON],
                },
              },
            ],
          },
          data: {
            status: "CANCELLED",
            paymentStatus: "PAID",
            cancelledAt: attempt.payment.order.cancelledAt || now,
            cancellationReason: LATE_PAYSTACK_PAYMENT_REASON,
          },
        });
        await notifyPaymentReconciliationRequired(
          transaction,
          attempt.payment.order
        );
      }
      const receipt = await issueReceipt({
        client: transaction,
        paymentId: attempt.payment.id,
        now,
        generateNumber: generateReceiptNumber,
      });
      return {
        orderReference: attempt.payment.order.reference,
        receiptNumber: receipt.receiptNumber,
        idempotent: false,
        requiresAdminReconciliation,
      };
    });
  } catch (error) {
    if (error?.code === "P2002" || error?.code === "P2034") {
      const settled = await loadAttempt(prismaClient, reference);
      if (settled?.payment?.status === "PAID" && settled.payment.receipt) {
        return {
          orderReference: settled.payment.order.reference,
          receiptNumber: settled.payment.receipt.receiptNumber,
          idempotent: true,
          requiresAdminReconciliation: requiresLatePaymentReconciliation(
            settled.payment.order
          ),
        };
      }
    }
    throw error;
  }
}

export async function verifyAndFinalizePaystackPayment({ prismaClient, reference, verifyProvider = verifyPaystackTransaction }) {
  const verified = await verifyProvider(reference);
  return finalizeVerifiedPaystackPayment({ prismaClient, reference, verified });
}

export async function markPaystackPaymentNotSuccessful({ prismaClient, reference, providerStatus }) {
  const attempt = await loadAttempt(prismaClient, reference);
  if (!attempt || attempt.payment.status === "PAID") return null;
  const status = providerStatus === "abandoned" ? "ABANDONED" : "FAILED";
  await prismaClient.$transaction([
    prismaClient.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["CREATED", "PENDING"] } },
      data: { status, providerStatus: providerStatus || "failed", completedAt: new Date() },
    }),
    prismaClient.payment.updateMany({
      where: { id: attempt.payment.id, status: "PENDING" },
      data: { status: "FAILED", failedAt: new Date() },
    }),
    prismaClient.order.updateMany({
      where: { id: attempt.payment.order.id, status: "AWAITING_PAYMENT" },
      data: { paymentStatus: "FAILED" },
    }),
  ]);
  return { orderReference: attempt.payment.order.reference };
}

export async function initiateFullPaystackRefund({
  prismaClient,
  adminUserId,
  orderReference,
  reason,
  createProviderRefund = createPaystackRefund,
  now = new Date(),
}) {
  const prepared = await prismaClient.$transaction(async (transaction) => {
    const admin = await transaction.user.findUnique({ where: { id: adminUserId }, select: { role: true } });
    if (admin?.role !== "ADMIN") throw new PaymentDomainError("ADMIN_REQUIRED", "Admin access is required.", 403);
    const order = await transaction.order.findUnique({
      where: { reference: orderReference },
      include: { payment: { include: { refund: true } } },
    });
    if (!order) throw new PaymentDomainError("ORDER_NOT_FOUND", "Order not found.", 404);
    if (order.payment?.refund) return { order, refund: order.payment.refund, idempotent: true };
    if (
      order.payment?.status !== "PAID" ||
      order.payment.provider !== PAYSTACK_PROVIDER ||
      !order.payment.providerRef ||
      !["PENDING", "CONFIRMED", "PREPARING"].includes(order.status)
    ) {
      throw new PaymentDomainError("REFUND_UNAVAILABLE", "This order is not eligible for a Paystack refund.");
    }
    const refund = await transaction.refund.create({
      data: {
        paymentId: order.payment.id,
        provider: PAYSTACK_PROVIDER,
        amountMinor: order.payment.amountMinor,
        currency: order.payment.currency,
        status: "PENDING",
        reason,
        initiatedById: adminUserId,
      },
    });
    await transaction.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: adminUserId,
        cancellationReason: reason,
      },
    });
    await transaction.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        changedById: adminUserId,
        changedAt: now,
      },
    });
    await notifyOrderCancelled(transaction, order, reason);
    return { order, refund, idempotent: false };
  });
  if (prepared.idempotent) return prepared;

  try {
    const providerRefund = await createProviderRefund(prepared.order.payment.providerRef, reason);
    const status = normalizeRefundStatus(providerRefund?.status);
    const refund = await prismaClient.refund.update({
      where: { id: prepared.refund.id },
      data: {
        status,
        providerRefundId: providerRefund?.id == null ? null : String(providerRefund.id),
        ...(status === REFUND_STATUS.PROCESSED ? { processedAt: now } : {}),
      },
    });
    if (status === REFUND_STATUS.PROCESSED) {
      await prismaClient.payment.update({ where: { id: refund.paymentId }, data: { status: "REFUNDED" } });
    }
    return { order: prepared.order, refund, idempotent: false };
  } catch (error) {
    await prismaClient.refund.update({ where: { id: prepared.refund.id }, data: { status: "FAILED" } });
    throw error;
  }
}

export async function processPaystackRefundEvent({ prismaClient, event, now = new Date() }) {
  const reference = event?.data?.transaction?.reference || event?.data?.transaction_reference;
  if (!reference) return { ignored: true };
  const payment = await prismaClient.payment.findUnique({
    where: { providerRef: reference },
    include: { refund: true },
  });
  if (!payment?.refund || payment.provider !== PAYSTACK_PROVIDER) return { ignored: true };
  const eventStatus = event.type?.replace("refund.", "") || event.data?.status;
  const status = normalizeRefundStatus(eventStatus);
  if (payment.refund.status === "PROCESSED") return { ignored: false, idempotent: true, status: "PROCESSED" };
  await prismaClient.$transaction(async (transaction) => {
    await transaction.refund.update({
      where: { id: payment.refund.id },
      data: {
        status,
        providerRefundId:
          event.data?.refund_reference == null && event.data?.id == null
            ? payment.refund.providerRefundId
            : String(event.data?.refund_reference ?? event.data.id),
        ...(status === "PROCESSED" ? { processedAt: now } : {}),
      },
    });
    if (status === "PROCESSED") {
      await transaction.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    }
  });
  return { ignored: false, idempotent: false, status };
}
