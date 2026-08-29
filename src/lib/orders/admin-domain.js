import { ORDER_STATUS, assertOrderStatusTransition } from "./domain.js";

export const ADMIN_ORDER_ACTION = Object.freeze({
  ACCEPT: "ACCEPT",
  CANCEL: "CANCEL",
  START_PREPARING: "START_PREPARING",
  MARK_READY: "MARK_READY",
  COMPLETE: "COMPLETE",
});

export const CANCELLATION_REASONS = Object.freeze([
  "Item unavailable",
  "Unable to fulfill order",
  "Restaurant issue",
]);

const ACTION_STATUS = Object.freeze({
  [ADMIN_ORDER_ACTION.ACCEPT]: ORDER_STATUS.CONFIRMED,
  [ADMIN_ORDER_ACTION.CANCEL]: ORDER_STATUS.CANCELLED,
  [ADMIN_ORDER_ACTION.START_PREPARING]: ORDER_STATUS.PREPARING,
  [ADMIN_ORDER_ACTION.MARK_READY]: ORDER_STATUS.READY_FOR_PICKUP,
  [ADMIN_ORDER_ACTION.COMPLETE]: ORDER_STATUS.COMPLETED,
});

const REFERENCE_PATTERN = /^[A-Z0-9-]{5,40}$/;
const TRUSTED_FIELDS = ["role", "adminUserId", "actorId", "changedById", "userId"];

function normalizeReason(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new TypeError("Cancellation reason is invalid.");
  const reason = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!reason || reason.length > 160) {
    throw new TypeError("Cancellation reason must be 160 characters or fewer.");
  }
  return reason;
}

export function prepareAdminOrderMutation(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The order update request is invalid.");
  }
  for (const field of TRUSTED_FIELDS) {
    if (Object.hasOwn(payload, field)) {
      throw new TypeError("Authorization context cannot be supplied by the browser.");
    }
  }

  const reference = typeof payload.reference === "string" ? payload.reference.trim().toUpperCase() : "";
  const nextStatus = ACTION_STATUS[payload.action];
  if (!REFERENCE_PATTERN.test(reference)) throw new TypeError("Order reference is invalid.");
  if (!nextStatus) throw new TypeError("The order action is not supported.");

  const cancellationReason = normalizeReason(payload.cancellationReason);
  if (payload.action !== ADMIN_ORDER_ACTION.CANCEL && cancellationReason) {
    throw new TypeError("A cancellation reason is only valid when cancelling an order.");
  }

  return { action: payload.action, reference, nextStatus, cancellationReason };
}

export function assertPreparedOrderTransition(currentStatus, mutation) {
  assertOrderStatusTransition(currentStatus, mutation.nextStatus);
  return mutation.nextStatus;
}
