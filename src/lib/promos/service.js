import {
  assertPromoCode,
  assertPromoEligibility,
  getPromoDiscountLabel,
  getPromoOrderSnapshot,
  PromoDomainError,
} from "./domain.js";

const promoSelect = {
  id: true,
  code: true,
  name: true,
  discountType: true,
  discountValue: true,
  active: true,
  startAt: true,
  endAt: true,
  minimumSubtotalMinor: true,
  maximumDiscountMinor: true,
  totalUsageLimit: true,
  perCustomerUsageLimit: true,
  restrictedCustomerId: true,
  claimedUsageCount: true,
  redeemedUsageCount: true,
};

async function requireCustomer(client, userId) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CUSTOMER") {
    throw new PromoDomainError(
      "PROMO_CUSTOMER_REQUIRED",
      "Sign in with a customer account to use a promo code.",
      user ? 403 : 401
    );
  }
  return user;
}

async function loadPromoContext(client, userId, rawCode) {
  const code = assertPromoCode(rawCode);
  await requireCustomer(client, userId);
  const promo = await client.promoCode.findUnique({
    where: { code },
    select: promoSelect,
  });
  const customerUsage = promo
    ? await client.promoCustomerUsage.findUnique({
        where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
        select: { claimedUsageCount: true, redeemedUsageCount: true },
      })
    : null;
  return { promo, customerUsage };
}

export async function previewPromo({
  prismaClient,
  userId,
  code,
  subtotalMinor,
  now = new Date(),
}) {
  const { promo, customerUsage } = await loadPromoContext(
    prismaClient,
    userId,
    code
  );
  const calculation = assertPromoEligibility(promo, {
    subtotalMinor,
    userId,
    now,
    customerClaimedUsage: customerUsage?.claimedUsageCount || 0,
  });
  return {
    code: promo.code,
    name: promo.name,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountLabel: getPromoDiscountLabel(promo),
    subtotalMinor,
    ...calculation,
  };
}

async function incrementCustomerClaim(transaction, promo, userId) {
  const existing = await transaction.promoCustomerUsage.findUnique({
    where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
    select: { id: true, claimedUsageCount: true },
  });
  if (!existing) {
    await transaction.promoCustomerUsage.create({
      data: { promoCodeId: promo.id, userId, claimedUsageCount: 1 },
    });
    return;
  }
  const where = {
    id: existing.id,
    ...(promo.perCustomerUsageLimit !== null
      ? { claimedUsageCount: { lt: promo.perCustomerUsageLimit } }
      : {}),
  };
  const changed = await transaction.promoCustomerUsage.updateMany({
    where,
    data: { claimedUsageCount: { increment: 1 } },
  });
  if (changed.count !== 1) {
    throw new PromoDomainError(
      "PROMO_CUSTOMER_LIMIT_REACHED",
      "You have already used this promo the maximum number of times."
    );
  }
}

export async function claimPromoForCheckout({
  transaction,
  userId,
  code,
  subtotalMinor,
  now = new Date(),
}) {
  const { promo, customerUsage } = await loadPromoContext(
    transaction,
    userId,
    code
  );
  const calculation = assertPromoEligibility(promo, {
    subtotalMinor,
    userId,
    now,
    customerClaimedUsage: customerUsage?.claimedUsageCount || 0,
  });
  const changed = await transaction.promoCode.updateMany({
    where: {
      id: promo.id,
      active: true,
      ...(promo.totalUsageLimit !== null
        ? { claimedUsageCount: { lt: promo.totalUsageLimit } }
        : {}),
    },
    data: { claimedUsageCount: { increment: 1 } },
  });
  if (changed.count !== 1) {
    throw new PromoDomainError(
      "PROMO_USAGE_LIMIT_REACHED",
      "This promo has reached its usage limit."
    );
  }
  await incrementCustomerClaim(transaction, promo, userId);
  return {
    promo,
    calculation,
    snapshot: getPromoOrderSnapshot(promo, calculation),
  };
}

export async function createPromoReservation({
  transaction,
  promoCodeId,
  orderId,
  userId,
}) {
  return transaction.promoRedemption.create({
    data: { promoCodeId, orderId, userId, status: "RESERVED" },
  });
}

export async function redeemPromoReservation(
  transaction,
  orderId,
  now = new Date(),
  { allowReleased = false } = {}
) {
  const redemption = await transaction.promoRedemption.findUnique({
    where: { orderId },
    select: { id: true, promoCodeId: true, userId: true, status: true },
  });
  if (!redemption || redemption.status === "REDEEMED") {
    return { changed: false, status: redemption?.status || null };
  }
  if (redemption.status !== "RESERVED" && !allowReleased) {
    throw new PromoDomainError(
      "PROMO_RESERVATION_RELEASED",
      "This promo reservation is no longer available.",
      409
    );
  }
  const wasReleased = redemption.status === "RELEASED";
  const changed = await transaction.promoRedemption.updateMany({
    where: {
      id: redemption.id,
      status: wasReleased ? "RELEASED" : "RESERVED",
    },
    data: { status: "REDEEMED", redeemedAt: now, releasedAt: null },
  });
  if (changed.count !== 1) return { changed: false, status: "STALE" };
  await transaction.promoCode.update({
    where: { id: redemption.promoCodeId },
    data: {
      ...(wasReleased ? { claimedUsageCount: { increment: 1 } } : {}),
      redeemedUsageCount: { increment: 1 },
    },
  });
  await transaction.promoCustomerUsage.update({
    where: {
      promoCodeId_userId: {
        promoCodeId: redemption.promoCodeId,
        userId: redemption.userId,
      },
    },
    data: {
      ...(wasReleased ? { claimedUsageCount: { increment: 1 } } : {}),
      redeemedUsageCount: { increment: 1 },
    },
  });
  return { changed: true, status: "REDEEMED" };
}

export async function releasePromoReservation(
  transaction,
  orderId,
  now = new Date()
) {
  const redemption = await transaction.promoRedemption.findUnique({
    where: { orderId },
    select: { id: true, promoCodeId: true, userId: true, status: true },
  });
  if (!redemption || redemption.status !== "RESERVED") {
    return { changed: false, status: redemption?.status || null };
  }
  const changed = await transaction.promoRedemption.updateMany({
    where: { id: redemption.id, status: "RESERVED" },
    data: { status: "RELEASED", releasedAt: now },
  });
  if (changed.count !== 1) return { changed: false, status: "STALE" };
  await transaction.promoCode.update({
    where: { id: redemption.promoCodeId },
    data: { claimedUsageCount: { decrement: 1 } },
  });
  await transaction.promoCustomerUsage.update({
    where: {
      promoCodeId_userId: {
        promoCodeId: redemption.promoCodeId,
        userId: redemption.userId,
      },
    },
    data: { claimedUsageCount: { decrement: 1 } },
  });
  return { changed: true, status: "RELEASED" };
}

export async function releasePromoReservationsForOrders(
  transaction,
  orderIds,
  now = new Date()
) {
  let released = 0;
  for (const orderId of orderIds) {
    const result = await releasePromoReservation(transaction, orderId, now);
    if (result.changed) released += 1;
  }
  return released;
}
