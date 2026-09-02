export const NOTIFICATION_TYPE = Object.freeze({
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  ORDER_ACCEPTED: "ORDER_ACCEPTED",
  ORDER_READY: "ORDER_READY",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  PAYMENT_RECONCILIATION_REQUIRED: "PAYMENT_RECONCILIATION_REQUIRED",
  NEW_ORDER: "NEW_ORDER",
  PAYMENT_EXCEPTION: "PAYMENT_EXCEPTION",
  NEW_KITCHEN_ORDER: "NEW_KITCHEN_ORDER",
});

export const NOTIFICATION_HISTORY_LIMIT = 25;
export const MAX_NOTIFICATION_HISTORY_LIMIT = 30;

export const IMPORTANT_CUSTOMER_NOTIFICATION_TYPES = Object.freeze([
  NOTIFICATION_TYPE.PAYMENT_CONFIRMED,
  NOTIFICATION_TYPE.ORDER_ACCEPTED,
  NOTIFICATION_TYPE.ORDER_READY,
  NOTIFICATION_TYPE.ORDER_CANCELLED,
  NOTIFICATION_TYPE.ORDER_COMPLETED,
  NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED,
]);

export const ADMIN_SOUND_NOTIFICATION_TYPES = Object.freeze([
  NOTIFICATION_TYPE.NEW_ORDER,
  NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED,
  NOTIFICATION_TYPE.PAYMENT_EXCEPTION,
]);

export const CHEF_SOUND_NOTIFICATION_TYPES = Object.freeze([
  NOTIFICATION_TYPE.NEW_KITCHEN_ORDER,
]);

export function isTrustedNotificationHref(href) {
  return (
    typeof href === "string" &&
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.includes("\\")
  );
}

export function normalizeNotificationLimit(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_NOTIFICATION_HISTORY_LIMIT)
    : NOTIFICATION_HISTORY_LIMIT;
}

export function normalizeNotificationMutation(payload) {
  if (payload?.action === "MARK_ALL_READ") {
    return { action: "MARK_ALL_READ" };
  }
  if (
    payload?.action === "MARK_READ" &&
    typeof payload.notificationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.notificationId
    )
  ) {
    return { action: "MARK_READ", notificationId: payload.notificationId };
  }
  throw new TypeError("Unsupported notification action.");
}
