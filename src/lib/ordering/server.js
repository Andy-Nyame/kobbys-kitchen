import "server-only";

import { isOrderingEnabled } from "@/lib/feature-flags";
import {
  assertOrderingStateOpenForSubmission,
  resolveEffectiveOrderingState,
} from "@/lib/ordering/state";
import { prisma } from "@/lib/prisma";

export async function getEffectiveOrderingState({ now = new Date() } = {}) {
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

  return resolveEffectiveOrderingState({
    featureEnabled: isOrderingEnabled(),
    setting,
    scheduleWindows: setting?.scheduleWindows || [],
    now,
  });
}

// Ordering availability gates new submissions only. It never cancels or mutates
// orders that were already accepted.
export async function assertOrderingOpenForSubmission(options) {
  const state = await getEffectiveOrderingState(options);

  return assertOrderingStateOpenForSubmission(state);
}
