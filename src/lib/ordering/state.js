export const ORDERING_TIME_ZONE = "Africa/Accra";

const MINUTES_PER_DAY = 24 * 60;
const TRANSITION_SEARCH_MINUTES = 8 * MINUTES_PER_DAY;
const WEEKDAY_NUMBER = new Map([
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
  ["Sun", 7],
]);
const OVERRIDE_MODES = new Set(["NONE", "OPEN", "CLOSED"]);
const accraClock = new Intl.DateTimeFormat("en-GB-u-ca-gregory", {
  timeZone: ORDERING_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export class OrderingConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OrderingConfigurationError";
    this.code = "ORDERING_CONFIGURATION_INVALID";
  }
}

export class OrderingClosedForSubmissionError extends Error {
  constructor(state) {
    super("Kobby’s Kitchen is not accepting new online orders right now.");
    this.name = "OrderingClosedForSubmissionError";
    this.code = "ORDERING_CLOSED";
    this.reason = state?.reason || "CLOSED";
  }
}

function normalizeDate(value, fieldName) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new OrderingConfigurationError(`${fieldName} must be a valid date.`);
  }

  return date;
}

function accraTimeParts(date) {
  const parts = Object.fromEntries(
    accraClock.formatToParts(date).map((part) => [part.type, part.value])
  );
  const dayOfWeek = WEEKDAY_NUMBER.get(parts.weekday);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  if (
    !dayOfWeek ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second)
  ) {
    throw new OrderingConfigurationError("The Africa/Accra clock could not be resolved.");
  }

  return {
    dayOfWeek,
    minuteOfDay: hour * 60 + minute + second / 60 + date.getUTCMilliseconds() / 60000,
  };
}

export function validateOrderingSchedule(windows) {
  if (!Array.isArray(windows)) {
    throw new OrderingConfigurationError("Schedule windows must be an array.");
  }

  const normalized = windows.map((window, index) => {
    if (!window || typeof window !== "object") {
      throw new OrderingConfigurationError(`Schedule window ${index + 1} is invalid.`);
    }

    const dayOfWeek = Number(window.dayOfWeek);
    const startMinute = Number(window.startMinute);
    const endMinute = Number(window.endMinute);
    const sortOrder = window.sortOrder === undefined ? index : Number(window.sortOrder);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new OrderingConfigurationError("Weekdays must be integers from 1 (Monday) to 7 (Sunday).");
    }

    if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute >= MINUTES_PER_DAY) {
      throw new OrderingConfigurationError("Schedule start minutes must be between 0 and 1439.");
    }

    if (!Number.isInteger(endMinute) || endMinute < 1 || endMinute > MINUTES_PER_DAY) {
      throw new OrderingConfigurationError("Schedule end minutes must be between 1 and 1440.");
    }

    if (startMinute >= endMinute) {
      throw new OrderingConfigurationError("Overnight or empty schedule windows are not supported.");
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new OrderingConfigurationError("Schedule sort order must be a non-negative integer.");
    }

    return { dayOfWeek, startMinute, endMinute, sortOrder };
  });

  normalized.sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startMinute - right.startMinute ||
      left.endMinute - right.endMinute ||
      left.sortOrder - right.sortOrder
  );

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];

    if (previous.dayOfWeek === current.dayOfWeek && current.startMinute < previous.endMinute) {
      throw new OrderingConfigurationError("Ordering schedule windows cannot overlap.");
    }
  }

  return normalized;
}

export function validateOrderingOverride({ mode = "NONE", expiresAt = null } = {}) {
  if (!OVERRIDE_MODES.has(mode)) {
    throw new OrderingConfigurationError("The ordering override mode is invalid.");
  }

  if (mode === "NONE" && expiresAt !== null && expiresAt !== undefined) {
    throw new OrderingConfigurationError("A NONE override cannot have an expiry.");
  }

  return {
    mode,
    expiresAt:
      expiresAt === null || expiresAt === undefined
        ? null
        : normalizeDate(expiresAt, "Override expiry"),
  };
}

function isScheduleOpen(windows, date) {
  const { dayOfWeek, minuteOfDay } = accraTimeParts(date);

  return windows.some(
    (window) =>
      window.dayOfWeek === dayOfWeek &&
      minuteOfDay >= window.startMinute &&
      minuteOfDay < window.endMinute
  );
}

function findNextScheduleTransition(windows, now) {
  if (windows.length === 0) {
    return null;
  }

  const openNow = isScheduleOpen(windows, now);
  const firstCandidate = Math.floor(now.getTime() / 60000) * 60000 + 60000;

  for (let offset = 0; offset <= TRANSITION_SEARCH_MINUTES; offset += 1) {
    const candidate = new Date(firstCandidate + offset * 60000);

    if (isScheduleOpen(windows, candidate) !== openNow) {
      return candidate;
    }
  }

  return null;
}

function scheduleTransitionFields(windows, now) {
  const open = isScheduleOpen(windows, now);
  const transition = findNextScheduleTransition(windows, now)?.toISOString() || null;

  return {
    open,
    nextOpenAt: open ? null : transition,
    nextCloseAt: open ? transition : null,
  };
}

function overrideTransitionFields({ mode, expiresAt, windows }) {
  if (!expiresAt) {
    return { nextOpenAt: null, nextCloseAt: null };
  }

  const scheduledAtExpiry = scheduleTransitionFields(windows, expiresAt);

  if (mode === "OPEN") {
    return {
      nextOpenAt: null,
      nextCloseAt: scheduledAtExpiry.open ? scheduledAtExpiry.nextCloseAt : expiresAt.toISOString(),
    };
  }

  return {
    nextOpenAt: scheduledAtExpiry.open ? expiresAt.toISOString() : scheduledAtExpiry.nextOpenAt,
    nextCloseAt: null,
  };
}

function stateResult({
  acceptingOrders,
  reason,
  source,
  now,
  nextOpenAt = null,
  nextCloseAt = null,
  emergencyPaused = false,
  overrideActive = false,
}) {
  return {
    acceptingOrders,
    reason,
    source,
    currentTime: now.toISOString(),
    nextOpenAt,
    nextCloseAt,
    emergencyPaused,
    overrideActive,
  };
}

export function resolveEffectiveOrderingState({
  featureEnabled,
  setting = null,
  scheduleWindows = [],
  now = new Date(),
}) {
  const currentTime = normalizeDate(now, "Current time");

  if (featureEnabled !== true) {
    return stateResult({
      acceptingOrders: false,
      reason: "BUILD_DISABLED",
      source: "BUILD_FLAG",
      now: currentTime,
    });
  }

  if (setting?.emergencyPaused === true) {
    return stateResult({
      acceptingOrders: false,
      reason: "EMERGENCY_PAUSED",
      source: "EMERGENCY_PAUSE",
      now: currentTime,
      emergencyPaused: true,
    });
  }

  let windows;
  let override;

  try {
    windows = validateOrderingSchedule(scheduleWindows);
    override = validateOrderingOverride({
      mode: setting?.overrideMode ?? "NONE",
      expiresAt: setting?.overrideExpiresAt ?? null,
    });
  } catch {
    return stateResult({
      acceptingOrders: false,
      reason: "CONFIGURATION_INVALID",
      source: "DEFAULT",
      now: currentTime,
    });
  }

  const overrideActive =
    override.mode !== "NONE" &&
    (!override.expiresAt || override.expiresAt.getTime() > currentTime.getTime());

  if (overrideActive) {
    const transition = overrideTransitionFields({
      mode: override.mode,
      expiresAt: override.expiresAt,
      windows,
    });

    return stateResult({
      acceptingOrders: override.mode === "OPEN",
      reason: override.mode === "OPEN" ? "FORCED_OPEN" : "FORCED_CLOSED",
      source: "OVERRIDE",
      now: currentTime,
      ...transition,
      overrideActive: true,
    });
  }

  if (windows.length === 0) {
    return stateResult({
      acceptingOrders: false,
      reason: "NO_SCHEDULE",
      source: "DEFAULT",
      now: currentTime,
    });
  }

  const schedule = scheduleTransitionFields(windows, currentTime);

  return stateResult({
    acceptingOrders: schedule.open,
    reason: schedule.open ? "SCHEDULE_OPEN" : "SCHEDULE_CLOSED",
    source: "SCHEDULE",
    now: currentTime,
    nextOpenAt: schedule.nextOpenAt,
    nextCloseAt: schedule.nextCloseAt,
  });
}

export function assertOrderingStateOpenForSubmission(state) {
  if (state?.acceptingOrders !== true) {
    throw new OrderingClosedForSubmissionError(state);
  }

  return state;
}

function earliestTransition(...values) {
  const candidates = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  return candidates[0]?.toISOString() || null;
}

// Physical business hours are a hard upper bound for new website orders.
// Online overrides deliberately cannot open checkout while the restaurant is
// physically closed. This combined state gates new submissions only; it never
// changes an order that was already accepted.
export function combineBusinessAndOnlineOrderingState({
  onlineState,
  businessState,
}) {
  const restaurantOpen = businessState?.restaurantOpen === true;
  const onlineOpen = onlineState?.acceptingOrders === true;

  // The deployment switch is the master online-ordering kill switch. Keep its
  // reason/source authoritative even when physical business hours are closed,
  // while still attaching the independently resolved restaurant state for UI.
  if (onlineState?.reason === "BUILD_DISABLED") {
    return {
      ...onlineState,
      acceptingOrders: false,
      restaurantOpen,
      businessReason: businessState?.reason || "BUSINESS_CLOSED",
      businessCurrentTime: businessState?.currentTime || onlineState?.currentTime,
      businessNextOpenAt: businessState?.nextOpenAt || null,
      businessNextCloseAt: restaurantOpen ? businessState?.nextCloseAt || null : null,
      onlineReason: onlineState.reason,
      onlineSource: onlineState.source,
      onlineNextOpenAt: onlineState.nextOpenAt || null,
      onlineNextCloseAt: onlineState.nextCloseAt || null,
    };
  }

  if (!restaurantOpen) {
    return {
      ...onlineState,
      acceptingOrders: false,
      reason: "RESTAURANT_CLOSED",
      source: "BUSINESS_HOURS",
      restaurantOpen: false,
      businessReason: businessState?.reason || "BUSINESS_CLOSED",
      businessCurrentTime: businessState?.currentTime || onlineState?.currentTime,
      businessNextOpenAt: businessState?.nextOpenAt || null,
      businessNextCloseAt: null,
      onlineReason: onlineState?.reason || "CLOSED",
      onlineSource: onlineState?.source || "DEFAULT",
      onlineNextOpenAt: onlineState?.nextOpenAt || null,
      onlineNextCloseAt: onlineState?.nextCloseAt || null,
    };
  }

  return {
    ...onlineState,
    acceptingOrders: onlineOpen,
    restaurantOpen: true,
    businessReason: businessState?.reason || "BUSINESS_OPEN",
    businessCurrentTime: businessState?.currentTime || onlineState?.currentTime,
    businessNextOpenAt: null,
    businessNextCloseAt: businessState?.nextCloseAt || null,
    onlineReason: onlineState?.reason || "CLOSED",
    onlineSource: onlineState?.source || "DEFAULT",
    onlineNextOpenAt: onlineState?.nextOpenAt || null,
    onlineNextCloseAt: onlineState?.nextCloseAt || null,
    nextCloseAt: onlineOpen
      ? earliestTransition(onlineState?.nextCloseAt, businessState?.nextCloseAt)
      : onlineState?.nextCloseAt || null,
  };
}
