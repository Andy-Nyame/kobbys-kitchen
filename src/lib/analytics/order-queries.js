import "server-only";

import { getDateRangeBounds } from "@/lib/admin/filters";
import { summarizeOrderMetrics } from "@/lib/analytics/order-metrics";
import { prisma } from "@/lib/prisma";

function getDateWhere({ fromIso, toExclusiveIso }) {
  return {
    ...(fromIso ? { gte: new Date(fromIso) } : {}),
    ...(toExclusiveIso ? { lt: new Date(toExclusiveIso) } : {}),
  };
}

function toDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function getOrderMetrics(dateRange = {}) {
  const bounds = getDateRangeBounds(dateRange);
  const dateWhere = getDateWhere(bounds);
  const hasRange = Object.keys(dateWhere).length > 0;
  const [orders, payments, completedOrders] = await Promise.all([
    prisma.order.findMany({
      where: hasRange ? { createdAt: dateWhere } : {},
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.findMany({
      where: hasRange
        ? {
            OR: [
              { status: "PAID", paidAt: dateWhere },
              { status: { not: "PAID" }, createdAt: dateWhere },
            ],
          }
        : {},
      select: {
        orderId: true,
        method: true,
        status: true,
        amountMinor: true,
        paidAt: true,
      },
    }),
    prisma.order.findMany({
      where: {
        status: "COMPLETED",
        payment: {
          is: {
            status: "PAID",
            ...(hasRange ? { paidAt: dateWhere } : {}),
          },
        },
      },
      select: {
        items: {
          select: { nameSnapshot: true, quantity: true, lineTotalMinor: true },
        },
      },
    }),
  ]);

  const metrics = summarizeOrderMetrics({
    orders,
    payments: payments.map((payment) => ({
      order_id: payment.orderId,
      method: payment.method,
      status: payment.status,
      amount_minor: payment.amountMinor,
    })),
  });
  const ordersByDay = new Map();
  const revenueByDay = new Map();
  const topItems = new Map();

  for (const order of orders) {
    const day = toDay(order.createdAt);
    ordersByDay.set(day, (ordersByDay.get(day) || 0) + 1);
  }

  for (const payment of payments) {
    if (payment.status !== "PAID" || !payment.paidAt) {
      continue;
    }

    const day = toDay(payment.paidAt);
    revenueByDay.set(day, (revenueByDay.get(day) || 0) + payment.amountMinor);
  }

  for (const order of completedOrders) {
    for (const item of order.items) {
      const current = topItems.get(item.nameSnapshot) || { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.lineTotalMinor;
      topItems.set(item.nameSnapshot, current);
    }
  }

  return {
    ...metrics,
    orderCountByDay: [...ordersByDay].map(([day, count]) => ({ day, count })),
    revenueByDay: [...revenueByDay].map(([day, revenue]) => ({
      day,
      revenue_minor: revenue,
    })),
    topItems: [...topItems]
      .map(([itemName, values]) => ({
        item_name: itemName,
        quantity: values.quantity,
        revenue_minor: values.revenue,
      }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 10),
  };
}
