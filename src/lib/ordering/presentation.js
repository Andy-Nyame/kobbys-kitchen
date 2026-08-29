import { ORDERING_TIME_ZONE, validateOrderingSchedule } from "./state.js";

export const WEEKDAYS = Object.freeze([
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 7, label: "Sunday" },
]);

function formatHour(hour, minute) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix} GMT`;
}

export function formatScheduleMinuteGmt(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1440) {
    throw new TypeError("Schedule time is invalid.");
  }

  if (value === 1440) return "12:00 AM GMT";
  return formatHour(Math.floor(value / 60), value % 60);
}

export function presentWeeklySchedule(windows = []) {
  const normalized = validateOrderingSchedule(windows);

  return WEEKDAYS.map(({ dayOfWeek, label }) => ({
    dayOfWeek,
    label,
    windows: normalized
      .filter((window) => window.dayOfWeek === dayOfWeek)
      .map((window) => ({
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        label: `${formatScheduleMinuteGmt(window.startMinute)} – ${formatScheduleMinuteGmt(window.endMinute)}`,
      })),
  }));
}

const datePartsFormatter = new Intl.DateTimeFormat("en-GB-u-ca-gregory", {
  timeZone: ORDERING_TIME_ZONE,
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function accraParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Transition time is invalid.");
  const parts = Object.fromEntries(
    datePartsFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    date,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function formatGmtTransition(targetValue, currentValue, verb) {
  if (!targetValue) return null;
  const target = accraParts(targetValue);
  const current = accraParts(currentValue);
  const tomorrow = accraParts(new Date(current.date.getTime() + 24 * 60 * 60 * 1000));
  const clock = formatHour(target.hour, target.minute);

  if (target.dateKey === current.dateKey) return `${verb} at ${clock}`;
  if (target.dateKey === tomorrow.dateKey) return `${verb} tomorrow at ${clock}`;
  return `${verb} ${target.weekday} at ${clock}`;
}

function formatRestaurantClose(targetValue) {
  if (!targetValue) return null;
  const target = accraParts(targetValue);
  return `Kobby’s Kitchen is open until ${formatHour(target.hour, target.minute)}.`;
}

function formatRestaurantReopen(targetValue, currentValue) {
  if (!targetValue) return null;
  const target = accraParts(targetValue);
  const current = accraParts(currentValue);
  const clock = formatHour(target.hour, target.minute);
  return target.dateKey === current.dateKey
    ? `Kobby’s Kitchen reopens at ${clock}.`
    : `Kobby’s Kitchen reopens ${target.weekday} at ${clock}.`;
}

export function presentPublicOrderingState(state) {
  const base = {
    isOpen: state?.acceptingOrders === true,
    label: state?.acceptingOrders === true ? "OPEN" : "CLOSED",
    timezone: "GMT",
    message: "Online ordering is currently closed.",
    detail: null,
    secondary: null,
    restaurantOpen: state?.restaurantOpen !== false,
    restaurantStatus: state?.restaurantOpen === false ? "CLOSED" : "OPEN",
  };

  if (state?.restaurantOpen === false) {
    return {
      ...base,
      message: state?.businessNextOpenAt
        ? "Kobby’s Kitchen is currently closed. Online ordering is unavailable."
        : "Kobby’s Kitchen is currently closed. Online ordering is unavailable.",
      detail: formatRestaurantReopen(
        state?.businessNextOpenAt,
        state?.businessCurrentTime || state?.currentTime
      ),
      onlineReason: state?.onlineReason || state?.reason,
    };
  }

  if (state?.acceptingOrders === true) {
    return {
      ...base,
      message: "Online pickup ordering is open.",
      detail: formatGmtTransition(state.nextCloseAt, state.currentTime, "Closes"),
      secondary: formatRestaurantClose(state?.businessNextCloseAt),
    };
  }

  if (state?.reason === "EMERGENCY_PAUSED") {
    return {
      ...base,
      message: "Online ordering is temporarily unavailable.",
      secondary: formatRestaurantClose(state?.businessNextCloseAt),
    };
  }

  if (state?.reason === "FORCED_CLOSED") {
    return {
      ...base,
      message: "Online ordering is temporarily closed.",
      detail: formatGmtTransition(state.nextOpenAt, state.currentTime, "Opens"),
      secondary: formatRestaurantClose(state?.businessNextCloseAt),
    };
  }

  if (state?.reason === "BUILD_DISABLED") {
    return {
      ...base,
      message: "Online pickup ordering is not enabled yet.",
      secondary: formatRestaurantClose(state?.businessNextCloseAt),
    };
  }

  return {
    ...base,
    detail: formatGmtTransition(state?.nextOpenAt, state?.currentTime, "Opens"),
    secondary: formatRestaurantClose(state?.businessNextCloseAt),
  };
}
