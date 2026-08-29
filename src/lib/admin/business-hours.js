import "server-only";

import { serializeBusinessHoursForEditor } from "@/lib/business-hours/admin-validation";
import {
  AdminBusinessHoursMutationError,
  executeAdminBusinessHoursMutation,
} from "@/lib/business-hours/admin-mutations";
import { getBusinessHoursConfiguration } from "@/lib/business-hours/server";
import { prisma } from "@/lib/prisma";

export { AdminBusinessHoursMutationError };

export async function getAdminBusinessHours() {
  const setting = await getBusinessHoursConfiguration();
  return {
    schedule: serializeBusinessHoursForEditor(setting?.windows || []),
    updatedAt: setting?.updatedAt?.toISOString() || null,
  };
}

export function mutateAdminBusinessHours({ adminUserId, mutation }) {
  return executeAdminBusinessHoursMutation({ prismaClient: prisma, adminUserId, mutation });
}
