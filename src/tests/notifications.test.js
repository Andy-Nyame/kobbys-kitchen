import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  NOTIFICATION_TYPE,
  isTrustedNotificationHref,
  normalizeNotificationMutation,
} from "../lib/notifications/domain.js";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notifyAdminsOfNewOrder,
  notifyOrderAccepted,
  notifyOrderCancelled,
  notifyOrderCompleted,
  notifyOrderReady,
  notifyPaymentConfirmed,
  notifyPaymentReconciliationRequired,
} from "../lib/notifications/service.js";

const ORDER = {
  id: "10000000-0000-4000-8000-000000000001",
  reference: "KK-20260902-NOTIFY1",
  userId: "20000000-0000-4000-8000-000000000001",
};

function notificationDouble() {
  const users = [
    { id: ORDER.userId, role: "CUSTOMER" },
    { id: "30000000-0000-4000-8000-000000000001", role: "ADMIN" },
    { id: "40000000-0000-4000-8000-000000000001", role: "CHEF" },
  ];
  const rows = new Map();
  let sequence = 0;
  const client = {
    user: {
      findMany: async ({ where }) => users.filter((user) => user.role === where.role),
    },
    notification: {
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const input of data) {
          if (rows.has(input.dedupeKey)) {
            if (!skipDuplicates) throw new Error("duplicate notification");
            continue;
          }
          sequence += 1;
          rows.set(input.dedupeKey, {
            id: `50000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
            readAt: null,
            ...input,
          });
          count += 1;
        }
        return { count };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of rows.values()) {
          if (where.id && row.id !== where.id) continue;
          if (row.userId !== where.userId) continue;
          if (where.readAt === null && row.readAt !== null) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
  };
  return { client, rows };
}

describe("persistent trusted notification events", () => {
  it("creates each customer lifecycle notification without exposing pickup credentials", async () => {
    const { client, rows } = notificationDouble();
    await notifyPaymentConfirmed(client, ORDER);
    await notifyOrderAccepted(client, ORDER);
    await notifyOrderReady(client, ORDER);
    await notifyOrderCancelled(client, ORDER, "Item unavailable");
    await notifyOrderCompleted(client, ORDER);

    const customerRows = [...rows.values()].filter((row) => row.userId === ORDER.userId);
    assert.deepEqual(
      customerRows.map((row) => row.type),
      [
        NOTIFICATION_TYPE.PAYMENT_CONFIRMED,
        NOTIFICATION_TYPE.ORDER_ACCEPTED,
        NOTIFICATION_TYPE.ORDER_READY,
        NOTIFICATION_TYPE.ORDER_CANCELLED,
        NOTIFICATION_TYPE.ORDER_COMPLETED,
      ]
    );
    assert.ok(customerRows.every((row) => row.href === `/account/orders/${ORDER.reference}`));
    assert.doesNotMatch(JSON.stringify(customerRows), /pickup.?code|[A-Z][0-9]{3}/i);
  });

  it("notifies Admin only for an operational order and Chef only after acceptance", async () => {
    const { client, rows } = notificationDouble();
    await notifyAdminsOfNewOrder(client, ORDER);
    assert.equal([...rows.values()].filter((row) => row.type === "NEW_ORDER").length, 1);
    assert.equal([...rows.values()].filter((row) => row.type === "NEW_KITCHEN_ORDER").length, 0);

    await notifyOrderAccepted(client, ORDER);
    const kitchen = [...rows.values()].find((row) => row.type === "NEW_KITCHEN_ORDER");
    assert.equal(kitchen.userId, "40000000-0000-4000-8000-000000000001");
    assert.equal(kitchen.href, "/kitchen");
  });

  it("deduplicates repeated payment, webhook, transition, and reconciliation events", async () => {
    const { client, rows } = notificationDouble();
    await notifyPaymentConfirmed(client, ORDER);
    await notifyPaymentConfirmed(client, ORDER);
    await notifyAdminsOfNewOrder(client, ORDER);
    await notifyAdminsOfNewOrder(client, ORDER);
    await notifyOrderReady(client, ORDER);
    await notifyOrderReady(client, ORDER);
    await notifyPaymentReconciliationRequired(client, ORDER);
    await notifyPaymentReconciliationRequired(client, ORDER);
    assert.equal(rows.size, 5);
    assert.equal(new Set([...rows.values()].map((row) => row.dedupeKey)).size, rows.size);
  });

  it("scopes mark-one and mark-all operations to the authenticated owner", async () => {
    const { client, rows } = notificationDouble();
    await notifyPaymentConfirmed(client, ORDER);
    await notifyAdminsOfNewOrder(client, ORDER);
    const customerRow = [...rows.values()].find((row) => row.userId === ORDER.userId);
    const adminId = "30000000-0000-4000-8000-000000000001";

    assert.equal((await markNotificationRead(client, adminId, customerRow.id)).count, 0);
    assert.equal(customerRow.readAt, null);
    assert.equal((await markNotificationRead(client, ORDER.userId, customerRow.id)).count, 1);
    assert.ok(customerRow.readAt instanceof Date);
    assert.equal((await markAllNotificationsRead(client, adminId)).count, 1);
  });

  it("accepts only bounded read actions and trusted application-owned links", () => {
    const id = "50000000-0000-4000-8000-000000000001";
    assert.deepEqual(normalizeNotificationMutation({ action: "MARK_READ", notificationId: id }), {
      action: "MARK_READ",
      notificationId: id,
    });
    assert.deepEqual(normalizeNotificationMutation({ action: "MARK_ALL_READ" }), {
      action: "MARK_ALL_READ",
    });
    assert.throws(() => normalizeNotificationMutation({ action: "CREATE" }));
    assert.equal(isTrustedNotificationHref("/account/orders/KK-1"), true);
    assert.equal(isTrustedNotificationHref("//attacker.example"), false);
    assert.equal(isTrustedNotificationHref("https://attacker.example"), false);
  });
});

describe("notification persistence and interface wiring", () => {
  it("uses an additive indexed Prisma model with a unique event identity", async () => {
    const [schema, migration] = await Promise.all([
      readFile("prisma/schema.prisma", "utf8"),
      readFile("prisma/migrations/20260902183000_add_persistent_notifications/migration.sql", "utf8"),
    ]);
    assert.match(schema, /model Notification \{/);
    assert.match(schema, /dedupeKey\s+String\s+@unique/);
    assert.match(schema, /@@index\(\[userId, readAt, createdAt\]\)/);
    assert.match(migration, /CREATE TYPE "NotificationType"/);
    assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/);
  });

  it("keeps notification reads authenticated, owned, bounded, and creation server-internal", async () => {
    const [route, queries] = await Promise.all([
      readFile("src/app/api/notifications/route.js", "utf8"),
      readFile("src/lib/notifications/queries.js", "utf8"),
    ]);
    assert.match(route, /getAuthenticatedUser/);
    assert.match(route, /markNotificationRead\(\s*prisma,\s*user\.id/);
    assert.doesNotMatch(route, /export async function PUT|export async function DELETE/);
    assert.match(queries, /where: \{ userId \}/);
    assert.match(queries, /take: safeLimit/);
    assert.match(queries, /count\(\{ where: \{ userId, readAt: null \} \}\)/);
  });

  it("renders shared Customer, Admin, and Kitchen bells with accessible badges and local sound preference", async () => {
    const [bell, siteHeader, adminWorkspace, kitchenPage] = await Promise.all([
      readFile("src/components/notifications/NotificationBell.jsx", "utf8"),
      readFile("src/components/layout/SiteHeader.jsx", "utf8"),
      readFile("src/components/admin/AdminWorkspace.jsx", "utf8"),
      readFile("src/app/kitchen/page.js", "utf8"),
    ]);
    assert.match(siteHeader, /role === "CUSTOMER"/);
    assert.match(siteHeader, /NotificationBell/);
    assert.match(adminWorkspace, /variant="admin"/);
    assert.match(kitchenPage, /variant="kitchen"/);
    assert.match(bell, /Notifications, \$\{snapshot\.unreadCount\} unread/);
    assert.match(bell, /99\+/);
    assert.match(bell, /Mark all read/);
    assert.match(bell, /localStorage\.setItem/);
    assert.match(bell, /AudioContext/);
  });

  it("polls quietly with one shared visibility-aware controller and toasts new IDs once", async () => {
    const [hook, bell, controller] = await Promise.all([
      readFile("src/components/operations/useOperationalAutoRefresh.js", "utf8"),
      readFile("src/components/notifications/NotificationBell.jsx", "utf8"),
      readFile("src/lib/operations/auto-refresh.js", "utf8"),
    ]);
    assert.match(hook, /const refreshSubscribers = new Set/);
    assert.match(hook, /sharedController/);
    assert.match(bell, /seenIdsRef/);
    assert.match(bell, /cache: "no-store"/);
    assert.doesNotMatch(bell, /location\.reload|router\.refresh/);
    assert.match(controller, /visibilitychange/);
    assert.match(controller, /clearInterval/);
  });

  it("generates events inside trusted order, payment, and pickup services only", async () => {
    const [checkout, payment, admin, pickup, expiry] = await Promise.all([
      readFile("src/lib/orders/checkout-service.js", "utf8"),
      readFile("src/lib/payments/service.js", "utf8"),
      readFile("src/lib/orders/admin-mutations.js", "utf8"),
      readFile("src/lib/pickup/service.js", "utf8"),
      readFile("src/lib/payments/expiry.js", "utf8"),
    ]);
    assert.match(checkout, /notifyAdminsOfNewOrder/);
    assert.match(payment, /notifyPaymentConfirmed/);
    assert.match(payment, /notifyPaymentReconciliationRequired/);
    assert.match(admin, /notifyOrderAccepted/);
    assert.match(admin, /notifyOrderCancelled/);
    assert.match(pickup, /notifyOrderReady/);
    assert.match(pickup, /notifyOrderCompleted/);
    assert.doesNotMatch(expiry, /notify/);
  });
});
