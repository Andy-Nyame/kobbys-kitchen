import "server-only";

import { ADMIN_PAGE_SIZE, getDateRangeBounds } from "@/lib/admin/filters";
import { ORDER_STATUS } from "@/lib/orders/domain";
import { executeAdminOrderMutation } from "@/lib/orders/admin-mutations";
import { markOrderReadyForPickup } from "@/lib/pickup/service";
import { prisma } from "@/lib/prisma";
const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_PICKUP,
];
export const HISTORY_ORDER_STATUSES = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
];

export { ACTIVE_ORDER_STATUSES };

export const NEW_ORDER_STATUSES = [ORDER_STATUS.PENDING];
export const IN_PROGRESS_ORDER_STATUSES = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_PICKUP,
];

function normalizeOrders(orders) {
  return (orders || []).map((order) => ({
    reference: order.reference,
    customer_name_snapshot: order.customerNameSnapshot,
    phone_snapshot: order.customerPhoneSnapshot,
    total_minor: order.totalMinor,
    currency: order.currency,
    status: order.status,
    created_at: order.createdAt,
    payment: order.payment || null,
    items: order.items || [],
    note: order.note || null,
    cancellation_reason: order.cancellationReason || null,
  }));
}

function getOrderDateWhere(filters) {
  const { fromIso, toExclusiveIso } = getDateRangeBounds(filters);
  return {
    ...(fromIso ? { gte: new Date(fromIso) } : {}),
    ...(toExclusiveIso ? { lt: new Date(toExclusiveIso) } : {}),
  };
}

const orderSelect = {
  reference: true,
  customerNameSnapshot: true,
  customerPhoneSnapshot: true,
  totalMinor: true,
  currency: true,
  status: true,
  note: true,
  cancellationReason: true,
  createdAt: true,
  payment: { select: { method: true, status: true } },
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      nameSnapshot: true,
      priceTier: true,
      unitPriceMinor: true,
      quantity: true,
      lineTotalMinor: true,
    },
  },
};

export async function getRecentAdminOrders(limit = 8) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const [activeOrders, recentOrders] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    }),
    prisma.order.findMany({
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    }),
  ]);
  const prioritized = [...activeOrders, ...recentOrders];
  const uniqueOrders = new Map();

  for (const order of prioritized) {
    if (!uniqueOrders.has(order.reference)) {
      uniqueOrders.set(order.reference, order);
    }
  }

  return normalizeOrders([...uniqueOrders.values()].slice(0, safeLimit));
}

export function mutateAdminOrder({ adminUserId, mutation }) {
  if (mutation.action === "MARK_READY") {
    return markOrderReadyForPickup({
      prismaClient: prisma,
      actorId: adminUserId,
      reference: mutation.reference,
    });
  }
  return executeAdminOrderMutation({ prismaClient: prisma, adminUserId, mutation });
}

export function countNewAdminOrders() {
  return prisma.order.count({ where: { status: ORDER_STATUS.PENDING } });
}

export async function listAdminOrders(filters, { statuses = null } = {}) {
  const start = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const dateWhere = getOrderDateWhere(filters);
  const scopedStatus =
    filters.orderStatus &&
    (!Array.isArray(statuses) || statuses.includes(filters.orderStatus))
      ? filters.orderStatus
      : null;
  const where = {
    ...(scopedStatus
      ? { status: scopedStatus }
      : Array.isArray(statuses)
        ? { status: { in: statuses } }
        : {}),
    ...(Object.keys(dateWhere).length ? { createdAt: dateWhere } : {}),
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search, mode: "insensitive" } },
            { customerNameSnapshot: { contains: filters.search, mode: "insensitive" } },
            { customerPhoneSnapshot: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.paymentMethod || filters.paymentStatus
      ? {
          payment: {
            is: {
              ...(filters.paymentMethod ? { method: filters.paymentMethod } : {}),
              ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
            },
          },
        }
      : {}),
  };
  const [data, count] = await Promise.all([
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      skip: start,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    rows: normalizeOrders(data),
    total: count,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}
