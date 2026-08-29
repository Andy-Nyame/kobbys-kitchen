import "server-only";

import { isOrderingEnabled } from "@/lib/feature-flags";
import { getEffectiveBusinessHoursState } from "@/lib/business-hours/server";
import {
  assertOrderingStateOpenForSubmission,
  combineBusinessAndOnlineOrderingState,
  resolveEffectiveOrderingState,
} from "@/lib/ordering/state";
import {
  presentPublicOrderingState,
} from "@/lib/ordering/presentation";
import { prisma } from "@/lib/prisma";

async function getOrderingConfiguration(client = prisma) {
  return client.orderingSetting.findUnique({
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
}

export async function getOnlineOrderingState({
  now = new Date(),
  client = prisma,
} = {}) {
  const setting = await getOrderingConfiguration(client);

  return resolveEffectiveOrderingState({
    featureEnabled: isOrderingEnabled(),
    setting,
    scheduleWindows: setting?.scheduleWindows || [],
    now,
  });
}

export async function getEffectiveOrderingState({
  now = new Date(),
  client = prisma,
} = {}) {
  const [onlineState, businessState] = await Promise.all([
    getOnlineOrderingState({ now, client }),
    getEffectiveBusinessHoursState({ now, client }),
  ]);

  return combineBusinessAndOnlineOrderingState({ onlineState, businessState });
}

export async function getPublicOrderingStatus(options) {
  return presentPublicOrderingState(await getEffectiveOrderingState(options));
}

// Ordering availability gates new submissions only. It never cancels or mutates
// orders that were already accepted.
export async function assertOrderingOpenForSubmission(options) {
  const state = await getEffectiveOrderingState(options);

  return assertOrderingStateOpenForSubmission(state);
}
