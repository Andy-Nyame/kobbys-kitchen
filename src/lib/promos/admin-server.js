import "server-only";

import { prisma } from "@/lib/prisma";
import { executeAdminPromoMutation } from "./admin-mutations.js";

export async function getAdminPromoWorkspace() {
  const [promos, customers] = await Promise.all([
    prisma.promoCode.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: {
        restrictedCustomer: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", email: { not: null } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
      take: 250,
    }),
  ]);
  return { promos, customers };
}

export function mutateAdminPromo({ adminUserId, mutation }) {
  return executeAdminPromoMutation({
    prismaClient: prisma,
    adminUserId,
    mutation,
  });
}
