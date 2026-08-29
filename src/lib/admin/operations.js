import "server-only";

import {
  AdminOrderingMutationError,
  executeAdminOrderingMutation,
} from "@/lib/ordering/admin-mutations";
import { serializeScheduleForEditor } from "@/lib/ordering/admin-validation";
import { getEffectiveOrderingState } from "@/lib/ordering/server";
import { prisma } from "@/lib/prisma";

export { AdminOrderingMutationError };

export async function getAdminOrderingOperations({ now = new Date() } = {}) {
  const setting = await prisma.orderingSetting.findUnique({
    where: { id: "default" },
    include: {
      scheduleWindows: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startMinute: "asc" },
          { sortOrder: "asc" },
        ],
      },
    },
  });
  const windows = setting?.scheduleWindows || [];
  const effectiveState = await getEffectiveOrderingState({
    now,
    client: prisma,
    orderingSetting: setting,
  });

  return {
    effectiveState,
    setting: {
      emergencyPaused: setting?.emergencyPaused === true,
      overrideMode: setting?.overrideMode || "NONE",
      overrideExpiresAt: setting?.overrideExpiresAt?.toISOString() || null,
      updatedAt: setting?.updatedAt?.toISOString() || null,
    },
    schedule: serializeScheduleForEditor(windows),
  };
}

export async function mutateAdminOrderingOperations({ adminUserId, mutation }) {
  return executeAdminOrderingMutation({
    prismaClient: prisma,
    adminUserId,
    mutation,
  });
}
