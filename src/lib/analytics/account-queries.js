import "server-only";

import {
  buildRegistrationTrend,
  getRegistrationBounds,
} from "@/lib/analytics/account-metrics";
import { prisma } from "@/lib/prisma";

export async function getAccountMetrics({ now = new Date() } = {}) {
  const { today, sevenDaysAgo, thirtyDaysAgo, tomorrow } = getRegistrationBounds(now);
  const [
    totalAccounts,
    customerCount,
    adminCount,
    registrationsToday,
    registrationsSevenDays,
    registrationsThirtyDays,
    googleAccountCount,
    credentialAccountCount,
    trendRegistrations,
    recentAccounts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo, lt: tomorrow } } }),
    prisma.user.count({ where: { accounts: { some: { provider: "google" } } } }),
    prisma.user.count({ where: { passwordHash: { not: null } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo, lt: tomorrow } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        accounts: { select: { provider: true } },
      },
    }),
  ]);

  return {
    totalAccounts,
    customerCount,
    adminCount,
    registrationsToday,
    registrationsSevenDays,
    registrationsThirtyDays,
    googleAccountCount,
    credentialAccountCount,
    registrationTrend: buildRegistrationTrend(
      trendRegistrations.map((entry) => entry.createdAt),
      now,
      7
    ),
    recentAccounts: recentAccounts.map((account) => ({
      id: account.id,
      name: account.name || "Name not added",
      email: account.email || "Email unavailable",
      role: account.role,
      createdAt: account.createdAt,
      providers: [...new Set(account.accounts.map((entry) => entry.provider))],
    })),
  };
}
