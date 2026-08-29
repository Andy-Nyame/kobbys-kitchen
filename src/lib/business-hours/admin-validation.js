import {
  validateBusinessHours,
} from "./state.js";

export const BUSINESS_HOURS_ADMIN_ACTION = Object.freeze({
  SAVE: "SAVE_BUSINESS_HOURS",
});

export const BUSINESS_HOURS_DAYS = Object.freeze([
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 7, label: "Sunday" },
]);

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TRUSTED_FIELDS = new Set([
  "role",
  "userId",
  "adminUserId",
  "actorId",
  "changedById",
]);

function toMinutes(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!TIME_PATTERN.test(normalized)) {
    throw new TypeError(`${fieldName} must be a valid 24-hour time.`);
  }
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

export function businessMinutesToTime(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1439) {
    throw new TypeError("Business-hours minutes are invalid.");
  }
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function prepareBusinessHoursMutation(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The business-hours request is invalid.");
  }
  for (const field of TRUSTED_FIELDS) {
    if (Object.hasOwn(payload, field)) {
      throw new TypeError("Authorization context cannot be supplied by the browser.");
    }
  }
  if (payload.action !== BUSINESS_HOURS_ADMIN_ACTION.SAVE) {
    throw new TypeError("The business-hours action is not supported.");
  }
  if (!Array.isArray(payload.windows) || payload.windows.length > 28) {
    throw new TypeError("Business hours must contain at most 28 windows.");
  }

  const windows = payload.windows.map((window, index) => {
    if (!window || typeof window !== "object" || Array.isArray(window)) {
      throw new TypeError(`Business-hours window ${index + 1} is invalid.`);
    }
    if (Object.hasOwn(window, "id") || Object.hasOwn(window, "endsNextDay")) {
      throw new TypeError("Business-hours identifiers and overnight state cannot be supplied directly.");
    }
    const startMinute = toMinutes(window.startTime, "Opening time");
    const endMinute = toMinutes(window.endTime, "Closing time");
    if (startMinute === endMinute) {
      throw new TypeError("Opening and closing time cannot be the same.");
    }
    return {
      dayOfWeek: Number(window.dayOfWeek),
      startMinute,
      endMinute,
      endsNextDay: endMinute < startMinute,
      sortOrder: index,
    };
  });

  return {
    action: payload.action,
    data: {
      windows: validateBusinessHours(windows).map((window, index) => ({
        ...window,
        sortOrder: index,
      })),
    },
  };
}

export function serializeBusinessHoursForEditor(windows = []) {
  const grouped = Object.fromEntries(
    BUSINESS_HOURS_DAYS.map(({ dayOfWeek }) => [dayOfWeek, []])
  );
  for (const window of validateBusinessHours(windows)) {
    grouped[window.dayOfWeek].push({
      startTime: businessMinutesToTime(window.startMinute),
      endTime: businessMinutesToTime(window.endMinute),
    });
  }
  return grouped;
}
