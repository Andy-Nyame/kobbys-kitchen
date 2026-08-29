import "server-only";

import { isOrderingEnabled } from "@/lib/feature-flags";
import {
  assertOrderingStateOpenForSubmission,
  resolveEffectiveOrderingState,
} from "@/lib/ordering/state";
import {
  presentPublicOrderingState,
  presentWeeklySchedule,
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

export async function getEffectiveOrderingState({
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

export async function getPublicOrderingStatus(options) {
  return presentPublicOrderingState(await getEffectiveOrderingState(options));
}

export async function getPublicOpeningHours() {
  const setting = await getOrderingConfiguration();
  return presentWeeklySchedule(setting?.scheduleWindows || []);
}

// Ordering availability gates new submissions only. It never cancels or mutates
// orders that were already accepted.
export async function assertOrderingOpenForSubmission(options) {
  const state = await getEffectiveOrderingState(options);

  return assertOrderingStateOpenForSubmission(state);
}
