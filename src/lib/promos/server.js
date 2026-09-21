import "server-only";

import { prisma } from "@/lib/prisma";
import { previewPromo } from "./service.js";

export function previewPromoForCustomer(userId, code, subtotalMinor) {
  return previewPromo({ prismaClient: prisma, userId, code, subtotalMinor });
}
