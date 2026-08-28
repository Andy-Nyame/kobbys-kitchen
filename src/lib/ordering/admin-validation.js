import {
  ORDERING_TIME_ZONE,
  validateOrderingSchedule,
} from "./state.js";

export const ORDERING_ADMIN_ACTION = Object.freeze({
  SAVE_SCHEDULE: "SAVE_SCHEDULE",
  SET_OVERRIDE: "SET_OVERRIDE",
  CLEAR_OVERRIDE: "CLEAR_OVERRIDE",
  PAUSE: "PAUSE",
  RESUME: "RESUME",
});

export const ORDERING_DAYS = Object.freeze([
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 7, label: "Sunday" },
]);

const MAX_SCHEDULE_WINDOWS = 70;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const END_TIME_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const TRUSTED_FIELDS = new Set([
  "role",
  "userId",
  "adminUserId",
  "actorId",
  "changedById",
  "updatedByUserId",
]);

function assertNoTrustedFields(payload) {
  for (const field of TRUSTED_FIELDS) {
    if (Object.hasOwn(payload, field)) {
      throw new TypeError("Authorization context cannot be supplied by the browser.");
    }
  }
}

function timeToMinutes(value, field, { allowEndOfDay = false } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const pattern = allowEndOfDay ? END_TIME_PATTERN : TIME_PATTERN;

  if (!pattern.test(normalized)) {
    throw new TypeError(`${field} must be a valid 24-hour time.`);
  }

  if (normalized === "24:00") {
    return 24 * 60;
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value) {
  if (!Number.isInteger(value) || value < 0 || value > 24 * 60) {
    throw new TypeError("Schedule minutes are invalid.");
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeSchedule(windows) {
  if (!Array.isArray(windows)) {
    throw new TypeError("The weekly schedule must be an array.");
  }

  if (windows.length > MAX_SCHEDULE_WINDOWS) {
    throw new TypeError("The weekly schedule has too many ordering windows.");
  }

  const normalized = windows.map((window, index) => {
    if (!window || typeof window !== "object" || Array.isArray(window)) {
      throw new TypeError(`Schedule window ${index + 1} is invalid.`);
    }

    if (Object.hasOwn(window, "id")) {
      throw new TypeError("Schedule window identifiers cannot be supplied.");
    }

    return {
      dayOfWeek: Number(window.dayOfWeek),
      startMinute: timeToMinutes(window.startTime, "Start time"),
      endMinute: timeToMinutes(window.endTime, "End time", {
        allowEndOfDay: true,
      }),
      sortOrder: index,
    };
  });

  return validateOrderingSchedule(normalized).map((window, index) => ({
    ...window,
    sortOrder: index,
  }));
}

function parseAccraDateTime(value, now) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    return null;
  }

  const match = LOCAL_DATE_TIME_PATTERN.exec(normalized);
  if (!match) {
    throw new TypeError("Override expiry must be a valid date and time.");
  }

  const [, year, month, day, hour, minute] = match;
  const expiry = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  );

  if (
    expiry.getUTCFullYear() !== Number(year) ||
    expiry.getUTCMonth() !== Number(month) - 1 ||
    expiry.getUTCDate() !== Number(day) ||
    expiry.getUTCHours() !== Number(hour) ||
    expiry.getUTCMinutes() !== Number(minute)
  ) {
    throw new TypeError("Override expiry must be a valid date and time.");
  }

  if (expiry.getTime() <= now.getTime()) {
    throw new TypeError("Override expiry must be in the future.");
  }

  // Africa/Accra currently uses UTC with no daylight-saving transition. Keeping
  // this conversion here makes the UI contract explicit and avoids browser or
  // machine timezone interpretation.
  if (ORDERING_TIME_ZONE !== "Africa/Accra") {
    throw new TypeError("The restaurant timezone is unavailable.");
  }

  return expiry;
}

export function prepareOrderingAdminMutation(payload, { now = new Date() } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The ordering operations request is invalid.");
  }

  assertNoTrustedFields(payload);

  switch (payload.action) {
    case ORDERING_ADMIN_ACTION.SAVE_SCHEDULE:
      return {
        action: payload.action,
        data: { windows: normalizeSchedule(payload.windows) },
      };
    case ORDERING_ADMIN_ACTION.SET_OVERRIDE: {
      if (payload.mode !== "OPEN" && payload.mode !== "CLOSED") {
        throw new TypeError("The ordering override must be OPEN or CLOSED.");
      }

      return {
        action: payload.action,
        data: {
          mode: payload.mode,
          expiresAt: parseAccraDateTime(payload.expiresAt, now),
        },
      };
    }
    case ORDERING_ADMIN_ACTION.CLEAR_OVERRIDE:
    case ORDERING_ADMIN_ACTION.PAUSE:
    case ORDERING_ADMIN_ACTION.RESUME:
      return { action: payload.action, data: {} };
    default:
      throw new TypeError("The ordering operations action is not supported.");
  }
}

export function serializeScheduleForEditor(windows) {
  const grouped = Object.fromEntries(
    ORDERING_DAYS.map(({ dayOfWeek }) => [dayOfWeek, []])
  );

  for (const window of validateOrderingSchedule(windows)) {
    grouped[window.dayOfWeek].push({
      startTime: minutesToTime(window.startMinute),
      endTime: minutesToTime(window.endMinute),
    });
  }

  return grouped;
}
