import { assertPreparedOrderTransition } from "./admin-domain.js";

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
      select: { id: true, reference: true, status: true, paymentStatus: true },
    });
    if (!order) {
      throw new AdminOrderMutationError("Order not found.", 404, "ORDER_NOT_FOUND");
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

    return {
      reference: order.reference,
      previousStatus: order.status,
      status: mutation.nextStatus,
      paymentStatus: order.paymentStatus,
    };
  });
}
