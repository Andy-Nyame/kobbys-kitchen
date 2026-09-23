import "server-only";

import { prisma } from "@/lib/prisma";
import { getPaymentAvailability } from "./domain.js";

export async function getCurrentPaymentAvailability({ customerEmail, client = prisma } = {}) {
  let cashOnPickupEnabled = false;

  try {
    const setting = await client.orderingSetting.findUnique({
      where: { id: "default" },
      select: { cashOnPickupEnabled: true },
    });
    cashOnPickupEnabled = setting?.cashOnPickupEnabled === true;
  } catch (error) {
    console.error("[payment-availability]", {
      category: error?.code || error?.name || "settings_lookup_failed",
    });
  }

  return getPaymentAvailability({ customerEmail, cashOnPickupEnabled });
}
