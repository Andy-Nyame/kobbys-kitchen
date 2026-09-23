import "server-only";

import { prisma } from "@/lib/prisma";
import { executeCashOnPickupSettingUpdate } from "./payment-settings.js";

export function updateCashOnPickupSetting({ adminUserId, cashOnPickupEnabled }) {
  return executeCashOnPickupSettingUpdate({
    prismaClient: prisma,
    adminUserId,
    cashOnPickupEnabled,
  });
}
