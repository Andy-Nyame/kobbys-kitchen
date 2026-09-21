import {
  normalizePromoCode,
  PROMO_CODE_PATTERN,
  PROMO_DISCOUNT_TYPE,
} from "./domain.js";

export const PROMO_ADMIN_ACTION = Object.freeze({
  CREATE: "CREATE_PROMO",
  UPDATE: "UPDATE_PROMO",
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function optionalText(value, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxLength) throw new TypeError(`Text must be ${maxLength} characters or fewer.`);
  return text || null;
}

function parseAccraDateTime(value, label) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !LOCAL_DATE_TIME_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a valid date and time.`);
  }
  const date = new Date(`${value}:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== value) {
    throw new TypeError(`${label} must be a valid date and time.`);
  }
  return date;
}

function optionalPositiveInteger(value, label) {
  if (value === null || value === "") return null;
  const integer = Number(value);
  if (!Number.isInteger(integer) || integer < 1 || integer > 1_000_000) {
    throw new TypeError(`${label} must be a positive whole number.`);
  }
  return integer;
}

export function parseCedisToMinor(value, label, { optional = false, allowZero = false } = {}) {
  if (optional && (value === null || value === "")) return null;
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new TypeError(`${label} must be a valid Ghana cedi amount.`);
  }
  const [cedis, pesewas = ""] = text.split(".");
  const minor = Number(cedis) * 100 + Number(pesewas.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor < (allowZero ? 0 : 1)) {
    throw new TypeError(`${label} must be greater than ${allowZero ? "or equal to " : ""}zero.`);
  }
  return minor;
}

function parsePercentageBasisPoints(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) {
    throw new TypeError("Percentage must be from 0.01 to 100.");
  }
  const [whole, decimals = ""] = text.split(".");
  const basisPoints = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  if (basisPoints < 1 || basisPoints > 10_000) {
    throw new TypeError("Percentage must be from 0.01 to 100.");
  }
  return basisPoints;
}

export function preparePromoMutation(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The promo request is invalid.");
  }
  for (const field of ["role", "userId", "adminUserId", "claimedUsageCount", "redeemedUsageCount"]) {
    if (Object.hasOwn(payload, field)) {
      throw new TypeError("Authorization and usage data cannot be supplied by the browser.");
    }
  }
  if (!Object.values(PROMO_ADMIN_ACTION).includes(payload.action)) {
    throw new TypeError("The promo action is not supported.");
  }
  if (payload.action === PROMO_ADMIN_ACTION.UPDATE && !UUID_PATTERN.test(payload.id || "")) {
    throw new TypeError("A valid promo identifier is required.");
  }
  const code = normalizePromoCode(payload.code);
  if (!PROMO_CODE_PATTERN.test(code)) {
    throw new TypeError("Promo code must be 3–32 letters, numbers, hyphens or underscores.");
  }
  if (!Object.values(PROMO_DISCOUNT_TYPE).includes(payload.discountType)) {
    throw new TypeError("Choose a supported discount type.");
  }
  const discountValue = payload.discountType === PROMO_DISCOUNT_TYPE.PERCENTAGE
    ? parsePercentageBasisPoints(payload.discountValue)
    : parseCedisToMinor(payload.discountValue, "Fixed discount");
  const startAt = parseAccraDateTime(payload.startAt, "Promo start");
  const endAt = parseAccraDateTime(payload.endAt, "Promo end");
  if (startAt && endAt && startAt > endAt) {
    throw new TypeError("Promo end must be after its start.");
  }
  const restrictedCustomerId = payload.restrictedCustomerId || null;
  if (restrictedCustomerId && !UUID_PATTERN.test(restrictedCustomerId)) {
    throw new TypeError("Choose a valid customer restriction.");
  }
  return {
    action: payload.action,
    promoId: payload.action === PROMO_ADMIN_ACTION.UPDATE ? payload.id : null,
    data: {
      code,
      name: optionalText(payload.name, 80),
      discountType: payload.discountType,
      discountValue,
      active: payload.active === true,
      startAt,
      endAt,
      minimumSubtotalMinor: parseCedisToMinor(payload.minimumSubtotal, "Minimum subtotal", { optional: true, allowZero: true }),
      maximumDiscountMinor: payload.discountType === PROMO_DISCOUNT_TYPE.PERCENTAGE
        ? parseCedisToMinor(payload.maximumDiscount, "Maximum discount", { optional: true })
        : null,
      totalUsageLimit: optionalPositiveInteger(payload.totalUsageLimit, "Total usage limit"),
      perCustomerUsageLimit: optionalPositiveInteger(payload.perCustomerUsageLimit, "Per-customer usage limit"),
      restrictedCustomerId,
    },
  };
}

export function serializePromoDateTime(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

export function serializePromoDiscountValue(promo) {
  return promo.discountType === PROMO_DISCOUNT_TYPE.PERCENTAGE
    ? (promo.discountValue / 100).toFixed(promo.discountValue % 100 ? 2 : 0)
    : (promo.discountValue / 100).toFixed(2);
}

export function serializeMinorToCedis(value) {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}
