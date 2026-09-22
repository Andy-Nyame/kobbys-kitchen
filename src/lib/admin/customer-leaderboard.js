function qualifyingOrderWhere() {
  return {
    status: "COMPLETED",
    fulfillmentType: "PICKUP",
    payment: {
      is: {
        status: "PAID",
        OR: [
          { refund: { is: null } },
          { refund: { is: { status: "FAILED" } } },
        ],
      },
    },
  };
}

export function rankCustomerLeaderboard(rows) {
  return [...rows].sort((left, right) => {
    if (right.completedOrderCount !== left.completedOrderCount) {
      return right.completedOrderCount - left.completedOrderCount;
    }
    const completionDifference =
      new Date(right.lastCompletedAt || 0).getTime() -
      new Date(left.lastCompletedAt || 0).getTime();
    if (completionDifference !== 0) return completionDifference;
    const nameDifference = left.customer.localeCompare(right.customer);
    if (nameDifference !== 0) return nameDifference;
    return (left.email || "").localeCompare(right.email || "");
  });
}

export async function listCustomerLeaderboard(prismaClient) {
  const customers = await prismaClient.user.findMany({
    where: {
      role: "CUSTOMER",
      orders: { some: qualifyingOrderWhere() },
    },
    select: {
      id: true,
      name: true,
      email: true,
      profile: { select: { displayName: true } },
      _count: {
        select: { orders: { where: qualifyingOrderWhere() } },
      },
      orders: {
        where: qualifyingOrderWhere(),
        orderBy: [{ completedAt: "desc" }, { id: "asc" }],
        take: 1,
        select: { completedAt: true },
      },
    },
  });

  return rankCustomerLeaderboard(
    customers.map((customer) => ({
      id: customer.id,
      customer:
        customer.profile?.displayName || customer.name || "Customer",
      email: customer.email,
      completedOrderCount: customer._count.orders,
      lastCompletedAt: customer.orders[0]?.completedAt || null,
    }))
  );
}
