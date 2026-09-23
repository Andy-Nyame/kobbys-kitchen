export class AdminPaymentSettingError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "AdminPaymentSettingError";
    this.status = status;
  }
}

export function prepareCashOnPickupSetting(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The payment-method setting request is invalid.");
  }
  if (typeof payload.cashOnPickupEnabled !== "boolean") {
    throw new TypeError("Choose whether Cash on Pickup is enabled or disabled.");
  }
  return { cashOnPickupEnabled: payload.cashOnPickupEnabled };
}

export async function executeCashOnPickupSettingUpdate({
  prismaClient,
  adminUserId,
  cashOnPickupEnabled,
}) {
  return prismaClient.$transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });
    if (actor?.role !== "ADMIN") {
      throw new AdminPaymentSettingError("Admin authorization is required.", 403);
    }

    return transaction.orderingSetting.upsert({
      where: { id: "default" },
      update: { cashOnPickupEnabled, changedById: adminUserId },
      create: { id: "default", cashOnPickupEnabled, changedById: adminUserId },
      select: { cashOnPickupEnabled: true, updatedAt: true },
    });
  });
}
