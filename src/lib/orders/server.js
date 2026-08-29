import "server-only";

import { assertOrderingOpenForSubmission } from "@/lib/ordering/server";
import { prisma } from "@/lib/prisma";
import { createTrustedPickupOrder } from "./checkout-service.js";

export function createPickupOrderForCustomer(userId, checkout) {
  return createTrustedPickupOrder({
    prismaClient: prisma,
    userId,
    checkout,
    assertOrderingOpen: assertOrderingOpenForSubmission,
  });
}
