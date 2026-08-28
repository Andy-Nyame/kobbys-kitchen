import "server-only";

import { isOrderingEnabled } from "@/lib/feature-flags";
import {
  AdminOrderingMutationError,
  executeAdminOrderingMutation,
} from "@/lib/ordering/admin-mutations";
import { serializeScheduleForEditor } from "@/lib/ordering/admin-validation";
import { resolveEffectiveOrderingState } from "@/lib/ordering/state";
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
  const effectiveState = resolveEffectiveOrderingState({
    featureEnabled: isOrderingEnabled(),
    setting,
    scheduleWindows: windows,
    now,
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
