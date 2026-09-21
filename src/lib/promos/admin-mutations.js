import { PROMO_ADMIN_ACTION } from "./admin-validation.js";

export class AdminPromoMutationError extends Error {
  constructor(message, status = 409, code = "PROMO_UPDATE_CONFLICT") {
    super(message);
    this.name = "AdminPromoMutationError";
    this.status = status;
    this.code = code;
  }
}

async function assertAdmin(transaction, userId) {
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") {
    throw new AdminPromoMutationError("Admin authorization is required.", 403, "ADMIN_REQUIRED");
  }
}

async function assertRestrictedCustomer(transaction, customerId) {
  if (!customerId) return;
  const customer = await transaction.user.findUnique({
    where: { id: customerId },
    select: { role: true },
  });
  if (customer?.role !== "CUSTOMER") {
    throw new AdminPromoMutationError("The selected customer is not available.", 400, "CUSTOMER_INVALID");
  }
}

export function executeAdminPromoMutation({ prismaClient, adminUserId, mutation }) {
  return prismaClient.$transaction(async (transaction) => {
    await assertAdmin(transaction, adminUserId);
    await assertRestrictedCustomer(transaction, mutation.data.restrictedCustomerId);

    if (mutation.action === PROMO_ADMIN_ACTION.CREATE) {
      return transaction.promoCode.create({
        data: mutation.data,
        select: { id: true, code: true },
      });
    }

    const existing = await transaction.promoCode.findUnique({
      where: { id: mutation.promoId },
      select: { id: true, claimedUsageCount: true, redeemedUsageCount: true },
    });
    if (!existing) {
      throw new AdminPromoMutationError("Promo code not found.", 404, "PROMO_NOT_FOUND");
    }
    if (
      mutation.data.totalUsageLimit !== null &&
      mutation.data.totalUsageLimit < existing.claimedUsageCount
    ) {
      throw new AdminPromoMutationError(
        "Total usage limit cannot be lower than the number already claimed.",
        400,
        "PROMO_LIMIT_INVALID"
      );
    }
    return transaction.promoCode.update({
      where: { id: mutation.promoId },
      data: mutation.data,
      select: { id: true, code: true },
    });
  });
}
