export const MAX_PRICE_TIER = 100;

export function normalizePriceTier(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PRICE_TIER
    ? value
    : null;
}

export function isValidPriceStepMinor(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function deriveMenuPriceMinor(item, priceTier) {
  const tier = normalizePriceTier(priceTier);
  const startingPrice = item?.priceMinor;
  const priceStep = item?.priceStepMinor;

  if (
    tier === null ||
    !Number.isSafeInteger(startingPrice) ||
    startingPrice < 0 ||
    !isValidPriceStepMinor(priceStep)
  ) {
    return null;
  }

  const selectedPrice = startingPrice + tier * priceStep;
  return Number.isSafeInteger(selectedPrice) ? selectedPrice : null;
}

export function getApprovedBackfillPriceStepMinor(startingPriceMinor) {
  if (!Number.isSafeInteger(startingPriceMinor) || startingPriceMinor < 0) {
    return null;
  }

  const remainder = startingPriceMinor % 1000;

  if (remainder === 0) {
    return 1000;
  }

  if (remainder === 500) {
    return 500;
  }

  return null;
}
