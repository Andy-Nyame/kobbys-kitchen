import {
  PickupWorkflowError,
  assertPickupActorRole,
  generatePickupCode,
  getPickupPresentation,
  isValidPickupCode,
  normalizePickupCode,
} from "./domain.js";
import { issueReceipt } from "../payments/receipts.js";

const PICKUP_ORDER_SELECT = {
  id: true,
  reference: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  pickupCode: true,
  customerNameSnapshot: true,
  totalMinor: true,
  currency: true,
  items: {
    orderBy: { createdAt: "asc" },
    select: { nameSnapshot: true, quantity: true, priceTier: true },
  },
  payment: {
    select: { id: true, method: true, status: true },
  },
};

async function requireActor(transaction, actorId) {
  const actor = await transaction.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });
  assertPickupActorRole(actor?.role);
  return actor;
}

function invalidCode() {
  return new PickupWorkflowError("That pickup code is invalid.", 404, "INVALID_PICKUP_CODE");
}

export async function markOrderReadyForPickup({
  prismaClient,
  actorId,
  reference,
  now = new Date(),
  generateCode = generatePickupCode,
  maxAttempts = 12,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pickupCode = generateCode();
    if (!isValidPickupCode(pickupCode)) {
      throw new TypeError("Pickup code generator returned an invalid code.");
    }

    try {
      return await prismaClient.$transaction(async (transaction) => {
        await requireActor(transaction, actorId);
        const order = await transaction.order.findUnique({
          where: { reference },
          select: PICKUP_ORDER_SELECT,
        });
        if (!order) throw new PickupWorkflowError("Order not found.", 404, "ORDER_NOT_FOUND");
        if (order.status === "READY_FOR_PICKUP" && order.pickupCode) {
          return { ...getPickupPresentation(order), pickupCode: order.pickupCode, idempotent: true };
        }
        if (!new Set(["CONFIRMED", "PREPARING"]).has(order.status)) {
          throw new PickupWorkflowError("Only accepted or preparing orders can be marked ready.", 409, "INVALID_ORDER_STATE");
        }

        const changed = await transaction.order.updateMany({
          where: { id: order.id, status: order.status, pickupCode: null },
          data: {
            status: "READY_FOR_PICKUP",
            pickupCode,
            pickupCodeGeneratedAt: now,
          },
        });
        if (changed.count !== 1) {
          throw new PickupWorkflowError("This order changed. Refresh and try again.", 409, "STALE_ORDER");
        }
        await transaction.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: "READY_FOR_PICKUP",
            changedById: actorId,
            changedAt: now,
          },
        });
        return {
          ...getPickupPresentation({ ...order, status: "READY_FOR_PICKUP" }),
          pickupCode,
          idempotent: false,
        };
      });
    } catch (error) {
      if (error?.code === "P2002" && attempt + 1 < maxAttempts) continue;
      throw error;
    }
  }
  throw new PickupWorkflowError("A pickup code could not be generated. Try again.", 503, "CODE_GENERATION_FAILED");
}

export async function verifyPickupCode({ prismaClient, actorId, code }) {
  const pickupCode = normalizePickupCode(code);
  if (!isValidPickupCode(pickupCode)) throw invalidCode();
  const actor = await prismaClient.user.findUnique({ where: { id: actorId }, select: { role: true } });
  assertPickupActorRole(actor?.role);
  const order = await prismaClient.order.findFirst({
    where: { pickupCode, status: "READY_FOR_PICKUP" },
    select: PICKUP_ORDER_SELECT,
  });
  if (!order) throw invalidCode();
  return getPickupPresentation(order);
}

export async function recordCashReceived({ prismaClient, actorId, code, now = new Date() }) {
  const pickupCode = normalizePickupCode(code);
  if (!isValidPickupCode(pickupCode)) throw invalidCode();
  return prismaClient.$transaction(async (transaction) => {
    await requireActor(transaction, actorId);
    const order = await transaction.order.findFirst({
      where: { pickupCode, status: "READY_FOR_PICKUP" },
      select: PICKUP_ORDER_SELECT,
    });
    if (!order) throw invalidCode();
    if (order.paymentMethod !== "CASH" || order.payment?.method !== "CASH") {
      throw new PickupWorkflowError("Only cash-at-pickup payments can be recorded here.", 409, "NOT_CASH_PAYMENT");
    }
    if (order.paymentStatus === "PAID" && order.payment?.status === "PAID") {
      const receipt = await issueReceipt({ client: transaction, paymentId: order.payment.id, issuedById: actorId, now });
      return { ...getPickupPresentation(order), paymentStatus: "PAID", receiptNumber: receipt.receiptNumber, idempotent: true };
    }
    if (order.paymentStatus !== "UNPAID" || order.payment?.status !== "UNPAID") {
      throw new PickupWorkflowError("This payment cannot be recorded in its current state.", 409, "INVALID_PAYMENT_STATE");
    }

    const paymentChanged = await transaction.payment.updateMany({
      where: { id: order.payment.id, status: "UNPAID" },
      data: { status: "PAID", paidAt: now, cashReceivedById: actorId },
    });
    const orderChanged = await transaction.order.updateMany({
      where: { id: order.id, status: "READY_FOR_PICKUP", paymentStatus: "UNPAID", pickupCode },
      data: { paymentStatus: "PAID" },
    });
    if (paymentChanged.count !== 1 || orderChanged.count !== 1) {
      throw new PickupWorkflowError("This payment changed. Verify the order again.", 409, "STALE_PAYMENT");
    }
    const receipt = await issueReceipt({ client: transaction, paymentId: order.payment.id, issuedById: actorId, now });
    return { ...getPickupPresentation(order), paymentStatus: "PAID", receiptNumber: receipt.receiptNumber, idempotent: false };
  });
}

export async function completePickup({ prismaClient, actorId, code, now = new Date() }) {
  const pickupCode = normalizePickupCode(code);
  if (!isValidPickupCode(pickupCode)) throw invalidCode();
  return prismaClient.$transaction(async (transaction) => {
    await requireActor(transaction, actorId);
    const order = await transaction.order.findFirst({
      where: { pickupCode, status: "READY_FOR_PICKUP" },
      select: PICKUP_ORDER_SELECT,
    });
    if (!order) throw invalidCode();
    if (order.paymentStatus !== "PAID" || order.payment?.status !== "PAID") {
      throw new PickupWorkflowError("Payment must be confirmed before pickup can be completed.", 409, "PAYMENT_REQUIRED");
    }

    const changed = await transaction.order.updateMany({
      where: { id: order.id, status: "READY_FOR_PICKUP", paymentStatus: "PAID", pickupCode },
      data: {
        status: "COMPLETED",
        completedAt: now,
        pickedUpAt: now,
        pickupCompletedById: actorId,
        pickupCode: null,
      },
    });
    if (changed.count !== 1) throw invalidCode();
    await transaction.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "READY_FOR_PICKUP",
        toStatus: "COMPLETED",
        changedById: actorId,
        changedAt: now,
      },
    });
    return { ...getPickupPresentation(order), status: "COMPLETED" };
  });
}
