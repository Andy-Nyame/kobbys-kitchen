import { ORDER_STATUS } from "./domain.js";

export const CUSTOMER_ACTIVE_ORDER_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_PICKUP,
]);

const NON_READY_ACTIVE_ORDER_STATUSES = Object.freeze(
  CUSTOMER_ACTIVE_ORDER_STATUSES.filter(
    (status) => status !== ORDER_STATUS.READY_FOR_PICKUP
  )
);

const customerHomeOrderSelect = Object.freeze({
  reference: true,
  status: true,
  totalMinor: true,
  currency: true,
  placedAt: true,
});

export function isCustomerActiveOrderStatus(status) {
  return CUSTOMER_ACTIVE_ORDER_STATUSES.includes(status);
}

export async function queryCustomerActiveOrderOverview(
  database,
  userId,
  { limit = 3 } = {}
) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 3) : 0;
  const ownership = {
    userId,
    status: { in: CUSTOMER_ACTIVE_ORDER_STATUSES },
  };

  if (safeLimit === 0) {
    return {
      totalCount: await database.order.count({ where: ownership }),
      orders: [],
    };
  }

  const [totalCount, readyOrders, otherOrders] = await Promise.all([
    database.order.count({ where: ownership }),
    database.order.findMany({
      where: { userId, status: ORDER_STATUS.READY_FOR_PICKUP },
      select: customerHomeOrderSelect,
      orderBy: { placedAt: "desc" },
      take: safeLimit,
    }),
    database.order.findMany({
      where: { userId, status: { in: NON_READY_ACTIVE_ORDER_STATUSES } },
      select: customerHomeOrderSelect,
      orderBy: { placedAt: "desc" },
      take: safeLimit,
    }),
  ]);

  return {
    totalCount,
    orders: [...readyOrders, ...otherOrders].slice(0, safeLimit),
  };
}
