import { BUSINESS_HOURS_ADMIN_ACTION } from "./admin-validation.js";

export class AdminBusinessHoursMutationError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "AdminBusinessHoursMutationError";
    this.status = status;
  }
}

export async function executeAdminBusinessHoursMutation({
  prismaClient,
  adminUserId,
  mutation,
}) {
  return prismaClient.$transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: adminUserId },
      select: { role: true },
    });
    if (actor?.role !== "ADMIN") {
      throw new AdminBusinessHoursMutationError("Admin authorization is required.", 403);
    }
    if (mutation.action !== BUSINESS_HOURS_ADMIN_ACTION.SAVE) {
      throw new AdminBusinessHoursMutationError("The business-hours operation is not supported.", 400);
    }

    await transaction.businessHoursSetting.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default", changedById: adminUserId },
    });
    await transaction.businessHoursWindow.deleteMany({
      where: { businessHoursSettingId: "default" },
    });
    if (mutation.data.windows.length > 0) {
      await transaction.businessHoursWindow.createMany({
        data: mutation.data.windows.map((window) => ({
          ...window,
          businessHoursSettingId: "default",
        })),
      });
    }
    await transaction.businessHoursSetting.update({
      where: { id: "default" },
      data: { changedById: adminUserId },
    });

    return { action: mutation.action, windowCount: mutation.data.windows.length };
  });
}
