import { assertPreparedOrderTransition } from "./admin-domain.js";
import {
  notifyOrderAccepted,
  notifyOrderCancelled,
} from "../notifications/service.js";

export class AdminOrderMutationError extends Error {
  constructor(message, status = 409, code = "ORDER_UPDATE_CONFLICT") {
    super(message);
    this.name = "AdminOrderMutationError";
    this.status = status;
    this.code = code;
  }
}

export async function executeAdminOrderMutation({
  prismaClient,
  adminUserId,
  mutation,
  now = new Date(),
}) {
  if (mutation?.nextStatus === "READY_FOR_PICKUP" || mutation?.nextStatus === "COMPLETED") {
    throw new AdminOrderMutationError(
      "Use the secure pickup workflow for ready and completed orders.",
      409,
      "PICKUP_WORKFLOW_REQUIRED"
    );
  }
  return prismaClient.$transaction(async (transaction) => {
    const admin = await transaction.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });
    if (admin?.role !== "ADMIN") {
      throw new AdminOrderMutationError("Admin authorization is required.", 403, "ADMIN_REQUIRED");
    }

    const order = await transaction.order.findUnique({
      where: { reference: mutation.reference },
      select: {
        id: true,
        reference: true,
        userId: true,
        status: true,
        paymentStatus: true,
        payment: { select: { status: true, provider: true } },
      },
    });
    if (!order) {
      throw new AdminOrderMutationError("Order not found.", 404, "ORDER_NOT_FOUND");
    }
    if (
      mutation.nextStatus === "CANCELLED" &&
      order.payment?.status === "PAID" &&
      order.payment.provider === "PAYSTACK"
    ) {
      throw new AdminOrderMutationError(
        "Use Cancel & Refund for a paid Paystack order.",
        409,
        "REFUND_REQUIRED"
      );
    }

    try {
      assertPreparedOrderTransition(order.status, mutation);
    } catch {
      throw new AdminOrderMutationError(
        "This order changed or the requested action is no longer allowed. Refresh and try again.",
        409,
        "INVALID_ORDER_TRANSITION"
      );
    }

    const data = {
      status: mutation.nextStatus,
      ...(mutation.nextStatus === "COMPLETED" ? { completedAt: now } : {}),
      ...(mutation.nextStatus === "CANCELLED"
        ? {
            cancelledAt: now,
            cancelledById: adminUserId,
            cancellationReason: mutation.cancellationReason,
          }
        : {}),
    };
    const changed = await transaction.order.updateMany({
      where: { id: order.id, status: order.status },
      data,
    });
    if (changed.count !== 1) {
      throw new AdminOrderMutationError(
        "This order was updated by someone else. Refresh before trying again.",
        409,
        "STALE_ORDER"
      );
    }

    await transaction.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: mutation.nextStatus,
        changedById: adminUserId,
        changedAt: now,
      },
    });

    if (mutation.nextStatus === "CONFIRMED") {
      await notifyOrderAccepted(transaction, order);
    } else if (mutation.nextStatus === "CANCELLED") {
      await notifyOrderCancelled(transaction, order, mutation.cancellationReason);
    }

    return {
      reference: order.reference,
      previousStatus: order.status,
      status: mutation.nextStatus,
      paymentStatus: order.paymentStatus,
    };
  });
}
