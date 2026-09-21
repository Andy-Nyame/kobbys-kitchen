export const PROMO_DISCOUNT_TYPE = Object.freeze({
  PERCENTAGE: "PERCENTAGE",
  FIXED_AMOUNT: "FIXED_AMOUNT",
});

export const PROMO_REDEMPTION_STATUS = Object.freeze({
  RESERVED: "RESERVED",
  REDEEMED: "REDEEMED",
  RELEASED: "RELEASED",
});

export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export class PromoDomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "PromoDomainError";
    this.code = code;
    this.status = status;
  }
}

export function normalizePromoCode(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().toUpperCase();
}

export function assertPromoCode(value) {
  const code = normalizePromoCode(value);
  if (!PROMO_CODE_PATTERN.test(code)) {
    throw new PromoDomainError(
      "PROMO_NOT_FOUND",
      "Promo code not found.",
      404
    );
  }
  return code;
}

function assertMinor(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
}

export function calculatePromoDiscount({
  discountType,
  discountValue,
  maximumDiscountMinor = null,
  subtotalMinor,
}) {
  assertMinor(subtotalMinor, "Subtotal");
  if (!Number.isSafeInteger(discountValue) || discountValue <= 0) {
    throw new TypeError("Promo discount value must be a positive integer.");
  }

  let discountMinor;
  if (discountType === PROMO_DISCOUNT_TYPE.PERCENTAGE) {
    if (discountValue > 10_000) {
      throw new TypeError("Percentage promo cannot exceed 100%.");
    }
    discountMinor = Number(
      (BigInt(subtotalMinor) * BigInt(discountValue)) / 10_000n
    );
    if (maximumDiscountMinor !== null) {
      assertMinor(maximumDiscountMinor, "Maximum discount");
      discountMinor = Math.min(discountMinor, maximumDiscountMinor);
    }
  } else if (discountType === PROMO_DISCOUNT_TYPE.FIXED_AMOUNT) {
    discountMinor = discountValue;
  } else {
    throw new TypeError("Promo discount type is not supported.");
  }

  discountMinor = Math.min(discountMinor, subtotalMinor);
  return {
    discountMinor,
    totalMinor: subtotalMinor - discountMinor,
  };
}

export function assertPromoEligibility(
  promo,
  { subtotalMinor, userId, now = new Date(), customerClaimedUsage = 0 } = {}
) {
  if (!promo) {
    throw new PromoDomainError("PROMO_NOT_FOUND", "Promo code not found.", 404);
  }
  assertMinor(subtotalMinor, "Subtotal");
  const timestamp = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new TypeError("Promo eligibility time is invalid.");
  }
  if (!promo.active) {
    throw new PromoDomainError("PROMO_INACTIVE", "This promo is not active.");
  }
  if (promo.startAt && timestamp < new Date(promo.startAt)) {
    throw new PromoDomainError(
      "PROMO_NOT_STARTED",
      "This promo is not active yet."
    );
  }
  if (promo.endAt && timestamp > new Date(promo.endAt)) {
    throw new PromoDomainError("PROMO_EXPIRED", "This promo has expired.");
  }
  if (promo.restrictedCustomerId && promo.restrictedCustomerId !== userId) {
    throw new PromoDomainError(
      "PROMO_ACCOUNT_RESTRICTED",
      "This promo is not available for this account.",
      403
    );
  }
  if (
    promo.minimumSubtotalMinor !== null &&
    subtotalMinor < promo.minimumSubtotalMinor
  ) {
    throw new PromoDomainError(
      "PROMO_MINIMUM_NOT_MET",
      "Your order does not meet the minimum amount for this promo."
    );
  }
  if (
    promo.totalUsageLimit !== null &&
    promo.claimedUsageCount >= promo.totalUsageLimit
  ) {
    throw new PromoDomainError(
      "PROMO_USAGE_LIMIT_REACHED",
      "This promo has reached its usage limit."
    );
  }
  if (
    promo.perCustomerUsageLimit !== null &&
    customerClaimedUsage >= promo.perCustomerUsageLimit
  ) {
    throw new PromoDomainError(
      "PROMO_CUSTOMER_LIMIT_REACHED",
      "You have already used this promo the maximum number of times."
    );
  }

  return calculatePromoDiscount({
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    maximumDiscountMinor: promo.maximumDiscountMinor,
    subtotalMinor,
  });
}

export function getPromoDiscountLabel(promo) {
  if (promo.discountType === PROMO_DISCOUNT_TYPE.PERCENTAGE) {
    const whole = Math.trunc(promo.discountValue / 100);
    const remainder = String(promo.discountValue % 100).padStart(2, "0");
    return `${remainder === "00" ? whole : `${whole}.${remainder}`}% discount`;
  }
  return "Fixed amount discount";
}

export function getPromoOrderSnapshot(promo, calculation) {
  return {
    promoCodeId: promo.id,
    promoCodeSnapshot: promo.code,
    promoDiscountTypeSnapshot: promo.discountType,
    promoDiscountValueSnapshot: promo.discountValue,
    discountMinor: calculation.discountMinor,
    totalMinor: calculation.totalMinor,
  };
}
