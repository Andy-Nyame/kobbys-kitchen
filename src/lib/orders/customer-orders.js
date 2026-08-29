import "server-only";

import { prisma } from "@/lib/prisma";

const customerOrderSelect = {
  reference: true,
  status: true,
  fulfillmentType: true,
  paymentMethod: true,
  paymentStatus: true,
  customerNameSnapshot: true,
  customerEmailSnapshot: true,
  customerPhoneSnapshot: true,
  note: true,
  subtotalMinor: true,
  totalMinor: true,
  currency: true,
  placedAt: true,
  createdAt: true,
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
  payment: {
    select: {
      method: true,
      status: true,
      amountMinor: true,
      currency: true,
    },
  },
};

export function listCustomerOrders(userId) {
  return prisma.order.findMany({
    where: { userId },
    select: customerOrderSelect,
    orderBy: { createdAt: "desc" },
  });
}

export function getCustomerOrderByReference(userId, reference) {
  return prisma.order.findFirst({
    where: { userId, reference },
    select: customerOrderSelect,
  });
}
