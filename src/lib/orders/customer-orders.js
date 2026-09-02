import "server-only";

import { prisma } from "@/lib/prisma";
import { queryCustomerActiveOrderOverview } from "@/lib/orders/customer-active";

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
  completedAt: true,
  pickupCode: true,
  pickupCodeGeneratedAt: true,
  pickedUpAt: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      nameSnapshot: true,
      menuItemId: true,
      priceTier: true,
      unitPriceMinor: true,
      quantity: true,
      lineTotalMinor: true,
      menuItem: {
        select: {
          id: true,
          active: true,
          available: true,
          priceMinor: true,
          priceStepMinor: true,
          category: { select: { active: true } },
        },
      },
    },
  },
  statusHistory: {
    orderBy: { changedAt: "asc" },
    select: { fromStatus: true, toStatus: true, changedAt: true },
  },
  payment: {
    select: {
      method: true,
      status: true,
      amountMinor: true,
      currency: true,
      provider: true,
      providerRef: true,
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
      receipt: { select: { receiptNumber: true, issuedAt: true } },
      refund: { select: { status: true, amountMinor: true, processedAt: true } },
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

export function getCustomerActiveOrderOverview(userId, options) {
  return queryCustomerActiveOrderOverview(prisma, userId, options);
}
