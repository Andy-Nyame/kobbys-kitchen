export const BUSINESS_TIME_ZONE = "Africa/Accra";

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;
const WEEKDAY_NUMBER = new Map([
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
  ["Sun", 7],
]);
const WEEKDAY_LABEL = new Map([
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
]);
const accraClock = new Intl.DateTimeFormat("en-GB-u-ca-gregory", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export class BusinessHoursConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BusinessHoursConfigurationError";
    this.code = "BUSINESS_HOURS_CONFIGURATION_INVALID";
  }
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BusinessHoursConfigurationError("The current business time is invalid.");
  }

  return date;
}

function getAccraWeekPosition(date) {
  const parts = Object.fromEntries(
    accraClock.formatToParts(date).map((part) => [part.type, part.value])
  );
  const dayOfWeek = WEEKDAY_NUMBER.get(parts.weekday);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  if (!dayOfWeek || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new BusinessHoursConfigurationError(
      "The Africa/Accra business clock could not be resolved."
    );
  }

  return {
    dayOfWeek,
    weekMinute:
      (dayOfWeek - 1) * MINUTES_PER_DAY +
      hour * 60 +
      minute +
      second / 60 +
      date.getUTCMilliseconds() / 60000,
  };
}

function baseInterval(window) {
  const start = (window.dayOfWeek - 1) * MINUTES_PER_DAY + window.startMinute;
  const end =
    (window.dayOfWeek - 1) * MINUTES_PER_DAY +
    (window.endsNextDay ? MINUTES_PER_DAY + window.endMinute : window.endMinute);

  return { ...window, start, end };
}

function expandedIntervals(windows) {
  const intervals = windows.map(baseInterval);

  return [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK]
    .flatMap((shift) =>
      intervals.map((interval) => ({
        ...interval,
        start: interval.start + shift,
        end: interval.end + shift,
      }))
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

export function validateBusinessHours(windows) {
  if (!Array.isArray(windows)) {
    throw new BusinessHoursConfigurationError("Business hours must be an array.");
  }

  const normalized = windows.map((window, index) => {
    if (!window || typeof window !== "object" || Array.isArray(window)) {
      throw new BusinessHoursConfigurationError(
        `Business-hours window ${index + 1} is invalid.`
      );
    }

    const dayOfWeek = Number(window.dayOfWeek);
    const startMinute = Number(window.startMinute);
    const endMinute = Number(window.endMinute);
    const endsNextDay = window.endsNextDay === true;
    const sortOrder = window.sortOrder === undefined ? index : Number(window.sortOrder);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new BusinessHoursConfigurationError(
        "Business weekdays must be integers from 1 (Monday) to 7 (Sunday)."
      );
    }

    if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute >= MINUTES_PER_DAY) {
      throw new BusinessHoursConfigurationError(
        "Business opening minutes must be between 0 and 1439."
      );
    }

    if (!Number.isInteger(endMinute) || endMinute < 0 || endMinute >= MINUTES_PER_DAY) {
      throw new BusinessHoursConfigurationError(
        "Business closing minutes must be between 0 and 1439."
      );
    }

    if (
      (!endsNextDay && startMinute >= endMinute) ||
      (endsNextDay && endMinute >= startMinute)
    ) {
      throw new BusinessHoursConfigurationError(
        "Business hours must have a valid same-day or explicit next-day closing time."
      );
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new BusinessHoursConfigurationError(
        "Business-hours sort order must be a non-negative integer."
      );
    }

    return { dayOfWeek, startMinute, endMinute, endsNextDay, sortOrder };
  });

  normalized.sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek ||
      left.startMinute - right.startMinute ||
      Number(left.endsNextDay) - Number(right.endsNextDay) ||
      left.endMinute - right.endMinute
  );

  const intervals = expandedIntervals(normalized);
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) {
      throw new BusinessHoursConfigurationError(
        "Physical business-hours windows cannot overlap."
      );
    }
  }

  return normalized;
}

function toTransitionIso(now, currentWeekMinute, targetWeekMinute) {
  return new Date(
    now.getTime() + (targetWeekMinute - currentWeekMinute) * 60 * 1000
  ).toISOString();
}

export function resolveBusinessHoursState({ windows = [], now = new Date() } = {}) {
  const currentTime = normalizeDate(now);
  const { dayOfWeek, weekMinute } = getAccraWeekPosition(currentTime);
  let normalized;

  try {
    normalized = validateBusinessHours(windows);
  } catch {
    return {
      restaurantOpen: false,
      reason: "CONFIGURATION_INVALID",
      source: "BUSINESS_HOURS",
      currentTime: currentTime.toISOString(),
      currentBusinessDay: dayOfWeek,
      currentBusinessDayLabel: WEEKDAY_LABEL.get(dayOfWeek),
      todayClosed: true,
      nextOpenAt: null,
      nextCloseAt: null,
    };
  }

  const intervals = expandedIntervals(normalized);
  const currentInterval = intervals.find(
    (interval) => weekMinute >= interval.start && weekMinute < interval.end
  );
  const todayClosed = !normalized.some((window) => window.dayOfWeek === dayOfWeek);

  if (currentInterval) {
    return {
      restaurantOpen: true,
      reason: "BUSINESS_OPEN",
      source: "BUSINESS_HOURS",
      currentTime: currentTime.toISOString(),
      currentBusinessDay: currentInterval.dayOfWeek,
      currentBusinessDayLabel: WEEKDAY_LABEL.get(currentInterval.dayOfWeek),
      todayClosed,
      nextOpenAt: null,
      nextCloseAt: toTransitionIso(currentTime, weekMinute, currentInterval.end),
    };
  }

  const nextInterval = intervals.find((interval) => interval.start > weekMinute);

  return {
    restaurantOpen: false,
    reason: normalized.length === 0 ? "NO_BUSINESS_HOURS" : "BUSINESS_CLOSED",
    source: "BUSINESS_HOURS",
    currentTime: currentTime.toISOString(),
    currentBusinessDay: dayOfWeek,
    currentBusinessDayLabel: WEEKDAY_LABEL.get(dayOfWeek),
    todayClosed,
    nextOpenAt: nextInterval
      ? toTransitionIso(currentTime, weekMinute, nextInterval.start)
      : null,
    nextCloseAt: null,
  };
}
