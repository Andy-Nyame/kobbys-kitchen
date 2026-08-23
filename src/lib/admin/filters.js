import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from "../orders/domain.js";

export const ADMIN_PAGE_SIZE = 25;

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEnum(value, allowedValues, field, errors) {
  const candidate = getSingleValue(value);

  if (!candidate) {
    return "";
  }

  if (!allowedValues.includes(candidate)) {
    errors[field] = "Unsupported filter value ignored.";
    return "";
  }

  return candidate;
}

function normalizeDate(value, field, errors) {
  const candidate = getSingleValue(value);

  if (!candidate) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    errors[field] = "Use a valid date in YYYY-MM-DD format.";
    return "";
  }

  const parsedDate = new Date(`${candidate}T00:00:00.000Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== candidate
  ) {
    errors[field] = "Use a real calendar date.";
    return "";
  }

  return candidate;
}

function normalizeSearch(value) {
  const candidate = getSingleValue(value);

  if (typeof candidate !== "string") {
    return "";
  }

  return candidate
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s+\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function normalizePage(value, errors) {
  const candidate = getSingleValue(value);

  if (!candidate) {
    return 1;
  }

  if (!/^\d+$/.test(candidate)) {
    errors.page = "Invalid page ignored.";
    return 1;
  }

  return Math.min(Math.max(Number(candidate), 1), 10000);
}

function normalizeDateRange(params, errors) {
  let from = normalizeDate(params.from, "from", errors);
  let to = normalizeDate(params.to, "to", errors);

  if (from && to && from > to) {
    errors.dateRange = "The start date must not be after the end date.";
    from = "";
    to = "";
  }

  return { from, to };
}

export function getDateRangeBounds({ from = "", to = "" } = {}) {
  const fromIso = from ? `${from}T00:00:00.000Z` : null;
  let toExclusiveIso = null;

  if (to) {
    const exclusiveDate = new Date(`${to}T00:00:00.000Z`);
    exclusiveDate.setUTCDate(exclusiveDate.getUTCDate() + 1);
    toExclusiveIso = exclusiveDate.toISOString();
  }

  return { fromIso, toExclusiveIso };
}

export function parseOrderFilters(params = {}) {
  const errors = {};
  const dateRange = normalizeDateRange(params, errors);

  return {
    values: {
      search: normalizeSearch(params.search),
      orderStatus: normalizeEnum(
        params.orderStatus,
        Object.values(ORDER_STATUS),
        "orderStatus",
        errors
      ),
      paymentMethod: normalizeEnum(
        params.paymentMethod,
        Object.values(PAYMENT_METHOD),
        "paymentMethod",
        errors
      ),
      paymentStatus: normalizeEnum(
        params.paymentStatus,
        Object.values(PAYMENT_STATUS),
        "paymentStatus",
        errors
      ),
      ...dateRange,
      page: normalizePage(params.page, errors),
    },
    errors,
  };
}

export function parsePaymentFilters(params = {}) {
  const errors = {};
  const dateRange = normalizeDateRange(params, errors);

  return {
    values: {
      search: normalizeSearch(params.search),
      paymentMethod: normalizeEnum(
        params.paymentMethod,
        Object.values(PAYMENT_METHOD),
        "paymentMethod",
        errors
      ),
      paymentStatus: normalizeEnum(
        params.paymentStatus,
        Object.values(PAYMENT_STATUS),
        "paymentStatus",
        errors
      ),
      ...dateRange,
      page: normalizePage(params.page, errors),
    },
    errors,
  };
}

export function parseAnalyticsFilters(params = {}) {
  const errors = {};

  return {
    values: normalizeDateRange(params, errors),
    errors,
  };
}
