const DAY_MS = 24 * 60 * 60 * 1000;

function startOfGmtDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Account metric date is invalid.");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getRegistrationBounds(now = new Date()) {
  const today = startOfGmtDay(now);
  return {
    today,
    sevenDaysAgo: new Date(today.getTime() - 6 * DAY_MS),
    thirtyDaysAgo: new Date(today.getTime() - 29 * DAY_MS),
    tomorrow: new Date(today.getTime() + DAY_MS),
  };
}

export function buildRegistrationTrend(registrationDates, now = new Date(), days = 7) {
  if (!Array.isArray(registrationDates) || !Number.isInteger(days) || days < 1 || days > 31) {
    throw new TypeError("Registration trend input is invalid.");
  }

  const today = startOfGmtDay(now);
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);
  const counts = new Map();

  for (const value of registrationDates) {
    const key = startOfGmtDay(value).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start.getTime() + index * DAY_MS);
    const key = day.toISOString().slice(0, 10);
    return { day: key, count: counts.get(key) || 0 };
  });
}
