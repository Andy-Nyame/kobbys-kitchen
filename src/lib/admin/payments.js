import "server-only";

import { ADMIN_PAGE_SIZE, getDateRangeBounds } from "@/lib/admin/filters";
import { prisma } from "@/lib/prisma";

export async function listAdminPayments(filters) {
  const start = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const { fromIso, toExclusiveIso } = getDateRangeBounds(filters);
  const where = {
    ...(filters.paymentMethod ? { method: filters.paymentMethod } : {}),
    ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
    ...(fromIso || toExclusiveIso
      ? {
          createdAt: {
            ...(fromIso ? { gte: new Date(fromIso) } : {}),
            ...(toExclusiveIso ? { lt: new Date(toExclusiveIso) } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? { order: { reference: { contains: filters.search, mode: "insensitive" } } }
      : {}),
  };
  const [data, count] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: start,
      take: ADMIN_PAGE_SIZE,
      select: {
        method: true,
        status: true,
        amountMinor: true,
        currency: true,
        provider: true,
        providerRef: true,
        paidAt: true,
        createdAt: true,
        order: {
          select: { reference: true, customerNameSnapshot: true, status: true },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    rows: data.map((payment) => ({
      method: payment.method,
      status: payment.status,
      amount_minor: payment.amountMinor,
      currency: payment.currency,
      provider: payment.provider,
      provider_reference: payment.providerRef,
      paid_at: payment.paidAt,
      created_at: payment.createdAt,
      order: {
        reference: payment.order.reference,
        customer_name_snapshot: payment.order.customerNameSnapshot,
        status: payment.order.status,
      },
    })),
    total: count,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}
