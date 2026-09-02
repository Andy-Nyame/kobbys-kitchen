import { NOTIFICATION_TYPE, isTrustedNotificationHref } from "./domain.js";

function customerOrderHref(reference) {
  return `/account/orders/${encodeURIComponent(reference)}`;
}

function safeCancellationReason(reason) {
  const normalized = typeof reason === "string" ? reason.trim() : "";
  return normalized ? normalized.slice(0, 160) : null;
}

function record({ userId, order, type, title, message, href, event }) {
  if (!userId || !order?.id || !order?.reference || !isTrustedNotificationHref(href)) {
    throw new TypeError("Trusted notification data is incomplete.");
  }
  return {
    userId,
    orderId: order.id,
    type,
    title,
    message,
    href,
    dedupeKey: `order:${order.id}:${event}:user:${userId}`,
  };
}

async function roleUserIds(client, role) {
  const users = await client.user.findMany({
    where: { role },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

async function persist(client, records) {
  if (!records.length) return { count: 0 };
  return client.notification.createMany({ data: records, skipDuplicates: true });
}

export async function notifyAdminsOfNewOrder(client, order) {
  const recipients = await roleUserIds(client, "ADMIN");
  return persist(
    client,
    recipients.map((userId) =>
      record({
        userId,
        order,
        type: NOTIFICATION_TYPE.NEW_ORDER,
        title: "New order",
        message: `New order ${order.reference} is waiting for confirmation.`,
        href: "/admin/orders?view=new",
        event: "new-order",
      })
    )
  );
}

export async function notifyPaymentConfirmed(client, order) {
  return persist(client, [
    record({
      userId: order.userId,
      order,
      type: NOTIFICATION_TYPE.PAYMENT_CONFIRMED,
      title: "Payment confirmed",
      message: `Your payment for order ${order.reference} was successful.`,
      href: customerOrderHref(order.reference),
      event: "payment-confirmed",
    }),
  ]);
}

export async function notifyPaymentReconciliationRequired(client, order) {
  const adminIds = await roleUserIds(client, "ADMIN");
  const records = [
    record({
      userId: order.userId,
      order,
      type: NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED,
      title: "Payment received after expiry",
      message: "Your payment was verified after the order expired. The restaurant will review it before further action.",
      href: customerOrderHref(order.reference),
      event: "late-payment-customer",
    }),
    ...adminIds.map((userId) =>
      record({
        userId,
        order,
        type: NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED,
        title: "Payment needs review",
        message: "A verified payment was received for an expired order. Review before taking further action.",
        href: "/admin/orders?view=history",
        event: "late-payment-admin",
      })
    ),
  ];
  return persist(client, records);
}

export async function notifyOrderAccepted(client, order) {
  const chefIds = await roleUserIds(client, "CHEF");
  return persist(client, [
    record({
      userId: order.userId,
      order,
      type: NOTIFICATION_TYPE.ORDER_ACCEPTED,
      title: "Order accepted",
      message: "Your order has been accepted and is being prepared.",
      href: customerOrderHref(order.reference),
      event: "accepted-customer",
    }),
    ...chefIds.map((userId) =>
      record({
        userId,
        order,
        type: NOTIFICATION_TYPE.NEW_KITCHEN_ORDER,
        title: "New kitchen order",
        message: `Order ${order.reference} is ready to prepare.`,
        href: "/kitchen",
        event: "accepted-kitchen",
      })
    ),
  ]);
}

export async function notifyOrderReady(client, order) {
  return persist(client, [
    record({
      userId: order.userId,
      order,
      type: NOTIFICATION_TYPE.ORDER_READY,
      title: "Your order is ready!",
      message: "Your order is ready for pickup.",
      href: customerOrderHref(order.reference),
      event: "ready",
    }),
  ]);
}

export async function notifyOrderCancelled(client, order, reason = null) {
  const safeReason = safeCancellationReason(reason);
  return persist(client, [
    record({
      userId: order.userId,
      order,
      type: NOTIFICATION_TYPE.ORDER_CANCELLED,
      title: "Order cancelled",
      message: safeReason
        ? `Your order has been cancelled. Reason: ${safeReason}`
        : "Your order has been cancelled.",
      href: customerOrderHref(order.reference),
      event: "cancelled",
    }),
  ]);
}

export async function notifyOrderCompleted(client, order) {
  return persist(client, [
    record({
      userId: order.userId,
      order,
      type: NOTIFICATION_TYPE.ORDER_COMPLETED,
      title: "Order completed",
      message: "Your pickup has been completed. Thank you for ordering from Kobby’s Kitchen.",
      href: customerOrderHref(order.reference),
      event: "completed",
    }),
  ]);
}

export async function markNotificationRead(client, userId, notificationId, now = new Date()) {
  return client.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: now },
  });
}

export async function markAllNotificationsRead(client, userId, now = new Date()) {
  return client.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: now },
  });
}
