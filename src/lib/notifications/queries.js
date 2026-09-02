import "server-only";

import { normalizeNotificationLimit } from "./domain.js";
import { prisma } from "@/lib/prisma";

function serialize(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    href: notification.href,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() || null,
  };
}

export async function getNotificationSnapshot(userId, { limit } = {}) {
  const safeLimit = normalizeNotificationLimit(limit);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        href: true,
        createdAt: true,
        readAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { notifications: notifications.map(serialize), unreadCount };
}
