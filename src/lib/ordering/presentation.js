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
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatScheduleMinuteGmt(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1440) {
    throw new TypeError("Schedule time is invalid.");
  }

  if (value === 1440) return "12:00 AM";
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

function formatOnlineOpening(targetValue, currentValue) {
  if (!targetValue) return null;
  const target = accraParts(targetValue);
  const current = accraParts(currentValue);
  const tomorrow = accraParts(new Date(current.date.getTime() + 24 * 60 * 60 * 1000));
  const clock = formatHour(target.hour, target.minute);

  if (target.dateKey === current.dateKey) {
    return `Online ordering opens today at ${clock}.`;
  }
  if (target.dateKey === tomorrow.dateKey) {
    return `Online ordering opens tomorrow at ${clock}.`;
  }
  return `Online ordering opens ${target.weekday} at ${clock}.`;
}

function formatOnlineClosing(targetValue) {
  if (!targetValue) return null;
  const target = accraParts(targetValue);
  return `Online orders close at ${formatHour(target.hour, target.minute)}.`;
}

function formatAfterOnlineWindow(businessCloseValue) {
  if (!businessCloseValue) {
    return "We’re no longer accepting new online orders today. Orders already placed will still be prepared for pickup.";
  }

  const close = accraParts(businessCloseValue);
  return `We’re no longer accepting new online orders today. Orders already placed will still be prepared for pickup before we close at ${formatHour(close.hour, close.minute)}.`;
}

function isSameAccraDate(leftValue, rightValue) {
  if (!leftValue || !rightValue) return false;
  return accraParts(leftValue).dateKey === accraParts(rightValue).dateKey;
}

export function presentPublicOrderingState(state) {
  const base = {
    isOpen: state?.acceptingOrders === true,
    label: state?.acceptingOrders === true ? "OPEN" : "CLOSED",
    headline: state?.acceptingOrders === true
      ? "Online Ordering Open"
      : "Online Ordering Closed",
    timezone: "Africa/Accra",
    message: "Online ordering is currently closed.",
    detail: null,
    secondary: null,
    restaurantOpen: state?.restaurantOpen !== false,
    restaurantStatus: state?.restaurantOpen === false ? "CLOSED" : "OPEN",
    businessDayClosed: state?.businessDayClosed === true,
  };

  if (state?.businessDayClosed === true) {
    return {
      ...base,
      message: "Kobby’s Kitchen is closed today. Online ordering is unavailable.",
      secondary: formatRestaurantReopen(
        state?.businessNextOpenAt,
        state?.businessCurrentTime || state?.currentTime
      ),
      onlineReason: state?.onlineReason || state?.reason,
    };
  }

  if (state?.acceptingOrders === true) {
    return {
      ...base,
      message: "Place your order online and pick it up when it’s ready.",
      detail: formatOnlineClosing(state.nextCloseAt),
    };
  }

  if (state?.reason === "EMERGENCY_PAUSED") {
    return {
      ...base,
      message: "Online ordering is temporarily unavailable.",
      secondary: state?.restaurantOpen
        ? formatRestaurantClose(state?.businessNextCloseAt)
        : null,
    };
  }

  if (state?.reason === "FORCED_CLOSED") {
    return {
      ...base,
      message: "Online ordering is temporarily closed.",
      detail: formatOnlineOpening(state.nextOpenAt, state.currentTime),
      secondary: state?.restaurantOpen
        ? formatRestaurantClose(state?.businessNextCloseAt)
        : null,
    };
  }

  if (state?.reason === "BUILD_DISABLED") {
    return {
      ...base,
      message: "Online ordering is temporarily unavailable.",
      secondary: state?.restaurantOpen
        ? formatRestaurantClose(state?.businessNextCloseAt)
        : null,
    };
  }

  const anotherWindowToday = isSameAccraDate(state?.nextOpenAt, state?.currentTime);

  return {
    ...base,
    message:
      state?.reason === "SCHEDULE_CLOSED" &&
      !anotherWindowToday &&
      state?.restaurantOpen === true
        ? formatAfterOnlineWindow(state?.businessNextCloseAt)
        : "Online ordering is currently closed.",
    detail: anotherWindowToday
      ? formatOnlineOpening(state?.nextOpenAt, state?.currentTime)
      : null,
    secondary:
      !anotherWindowToday && state?.restaurantOpen !== true
        ? formatOnlineOpening(state?.nextOpenAt, state?.currentTime)
        : null,
  };
}
