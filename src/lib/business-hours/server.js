import "server-only";

import { presentBusinessHours } from "@/lib/business-hours/presentation";
import { resolveBusinessHoursState } from "@/lib/business-hours/state";
import { prisma } from "@/lib/prisma";

export function getBusinessHoursConfiguration(client = prisma) {
  return client.businessHoursSetting.findUnique({
    where: { id: "default" },
    include: {
      windows: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startMinute: "asc" },
          { sortOrder: "asc" },
        ],
      },
    },
  });
}

export async function getEffectiveBusinessHoursState({
  now = new Date(),
  client = prisma,
} = {}) {
  const setting = await getBusinessHoursConfiguration(client);
  return resolveBusinessHoursState({ windows: setting?.windows || [], now });
}

export async function getPublicBusinessHours() {
  const setting = await getBusinessHoursConfiguration();
  return presentBusinessHours(setting?.windows || []);
}
