import {
  CAMPAIGN_POPUP_FREQUENCIES,
  isSafeCampaignDestination,
} from "./domain.js";

export const CAMPAIGN_ADMIN_ACTION = Object.freeze({
  UPDATE: "UPDATE_CAMPAIGN",
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TRUSTED_FIELDS = new Set(["role", "userId", "adminUserId", "actorId"]);

function requiredBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be true or false.`);
  }
  return value;
}

function parseAccraDateTime(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !LOCAL_DATE_TIME_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a valid date and time.`);
  }

  const parsed = new Date(`${value}:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== value) {
    throw new TypeError(`${label} must be a valid date and time.`);
  }
  return parsed;
}

export function prepareCampaignMutation(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The campaign request is invalid.");
  }
  for (const field of TRUSTED_FIELDS) {
    if (Object.hasOwn(payload, field)) {
      throw new TypeError("Authorization context cannot be supplied by the browser.");
    }
  }
  if (payload.action !== CAMPAIGN_ADMIN_ACTION.UPDATE) {
    throw new TypeError("The campaign action is not supported.");
  }
  if (typeof payload.id !== "string" || !UUID_PATTERN.test(payload.id)) {
    throw new TypeError("A valid campaign identifier is required.");
  }

  const startAt = parseAccraDateTime(payload.startAt, "Campaign start");
  const endAt = parseAccraDateTime(payload.endAt, "Campaign end");
  if (startAt && endAt && startAt > endAt) {
    throw new TypeError("Campaign end must be after its start.");
  }

  const priority = Number(payload.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
    throw new TypeError("Campaign priority must be a whole number from 0 to 10000.");
  }

  const destinationPath = typeof payload.destinationPath === "string"
    ? payload.destinationPath.trim()
    : "";
  if (!isSafeCampaignDestination(destinationPath)) {
    throw new TypeError("Campaign destination must be a safe internal path.");
  }
  if (!CAMPAIGN_POPUP_FREQUENCIES.includes(payload.popupFrequency)) {
    throw new TypeError("Campaign popup frequency is not supported.");
  }

  return {
    action: payload.action,
    campaignId: payload.id,
    data: {
      active: requiredBoolean(payload.active, "Active state"),
      slideshowEnabled: requiredBoolean(payload.slideshowEnabled, "Slideshow state"),
      popupEnabled: requiredBoolean(payload.popupEnabled, "Popup state"),
      startAt,
      endAt,
      priority,
      destinationPath,
      popupFrequency: payload.popupFrequency,
    },
  };
}

export function serializeCampaignDateTimeForEditor(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}
