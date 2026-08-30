import "server-only";

import { prisma } from "@/lib/prisma";

const KITCHEN_SELECT = {
  reference: true,
  status: true,
  customerNameSnapshot: true,
  note: true,
  totalMinor: true,
  currency: true,
  createdAt: true,
  payment: { select: { method: true, status: true } },
  items: {
    orderBy: { createdAt: "asc" },
    select: { nameSnapshot: true, priceTier: true, quantity: true },
  },
  statusHistory: {
    where: { toStatus: "CONFIRMED" },
    orderBy: { changedAt: "asc" },
    take: 1,
    select: { changedAt: true },
  },
};

function normalize(order) {
  return {
    reference: order.reference,
    status: order.status,
    pickupName: order.customerNameSnapshot,
    note: order.note,
    totalMinor: order.totalMinor,
    currency: order.currency,
    acceptedAt: order.statusHistory[0]?.changedAt || order.createdAt,
    payment: order.payment,
    items: order.items,
  };
}

export async function listKitchenOrders(prismaClient = prisma) {
  const [active, ready] = await Promise.all([
    prismaClient.order.findMany({
      where: { status: { in: ["CONFIRMED", "PREPARING"] } },
      select: KITCHEN_SELECT,
    }),
    prismaClient.order.findMany({
      where: { status: "READY_FOR_PICKUP" },
      select: KITCHEN_SELECT,
      orderBy: { pickupCodeGeneratedAt: "asc" },
    }),
  ]);

  return {
    active: active.map(normalize).sort((a, b) => new Date(a.acceptedAt) - new Date(b.acceptedAt)),
    ready: ready.map(normalize),
  };
}
