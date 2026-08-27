import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAdminOrderingSettings() {
  const data = await prisma.orderingSetting.findUnique({
    where: { id: "default" },
  });

  return {
    acceptingOrders: data?.acceptingOrders === true,
    updatedAt: data?.updatedAt || null,
    configured: Boolean(data),
  };
}
