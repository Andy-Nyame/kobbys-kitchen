import { BUSINESS_TIME_ZONE, validateBusinessHours } from "./state.js";

export const BUSINESS_WEEKDAYS = Object.freeze([
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 7, label: "Sunday" },
]);

function formatHour(hour, minute, { timezone = false } = {}) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}${timezone ? " GMT" : ""}`;
}

export function formatBusinessMinute(value, options) {
  if (!Number.isInteger(value) || value < 0 || value > 1439) {
    throw new TypeError("Business-hours time is invalid.");
  }

  return formatHour(Math.floor(value / 60), value % 60, options);
}

export function presentBusinessHours(windows = []) {
  const normalized = validateBusinessHours(windows);

  return BUSINESS_WEEKDAYS.map(({ dayOfWeek, label }) => ({
    dayOfWeek,
    label,
    windows: normalized
      .filter((window) => window.dayOfWeek === dayOfWeek)
      .map((window) => ({
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        endsNextDay: window.endsNextDay,
        label: `${formatBusinessMinute(window.startMinute)} – ${formatBusinessMinute(window.endMinute)}`,
      })),
  }));
}

const dateFormatter = new Intl.DateTimeFormat("en-GB-u-ca-gregory", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dateParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Business transition is invalid.");
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    date,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function formatBusinessTransition(targetValue, currentValue, verb) {
  if (!targetValue) return null;
  const target = dateParts(targetValue);
  const current = dateParts(currentValue);
  const tomorrow = dateParts(new Date(current.date.getTime() + 24 * 60 * 60 * 1000));
  const clock = formatHour(target.hour, target.minute, { timezone: true });

  if (target.dateKey === current.dateKey) return `${verb} at ${clock}`;
  if (target.dateKey === tomorrow.dateKey) return `${verb} tomorrow at ${clock}`;
  return `${verb} ${target.weekday} at ${clock}`;
}
