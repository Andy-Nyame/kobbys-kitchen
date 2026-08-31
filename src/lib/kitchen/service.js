import { ORDER_STATUS, assertOrderStatusTransition } from "../orders/domain.js";
import { PickupWorkflowError, assertPickupActorRole } from "../pickup/domain.js";

export async function startOrderPreparation({
  prismaClient,
  actorId,
  reference,
  now = new Date(),
}) {
  return prismaClient.$transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    assertPickupActorRole(actor?.role);

    const order = await transaction.order.findUnique({
      where: { reference },
      select: { id: true, reference: true, status: true },
    });
    if (!order) {
      throw new PickupWorkflowError("Order not found.", 404, "ORDER_NOT_FOUND");
    }

    try {
      assertOrderStatusTransition(order.status, ORDER_STATUS.PREPARING);
    } catch {
      throw new PickupWorkflowError(
        "Only an accepted order can start preparation.",
        409,
        "INVALID_ORDER_STATE"
      );
    }

    const changed = await transaction.order.updateMany({
      where: { id: order.id, status: ORDER_STATUS.CONFIRMED },
      data: { status: ORDER_STATUS.PREPARING },
    });
    if (changed.count !== 1) {
      throw new PickupWorkflowError(
        "This order changed. Refresh and try again.",
        409,
        "STALE_ORDER"
      );
    }

    await transaction.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: ORDER_STATUS.CONFIRMED,
        toStatus: ORDER_STATUS.PREPARING,
        changedById: actorId,
        changedAt: now,
      },
    });

    return {
      reference: order.reference,
      previousStatus: ORDER_STATUS.CONFIRMED,
      status: ORDER_STATUS.PREPARING,
    };
  });
}
