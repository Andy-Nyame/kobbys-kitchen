import { ORDERING_ADMIN_ACTION } from "./admin-validation.js";

export class AdminOrderingMutationError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "AdminOrderingMutationError";
    this.status = status;
  }
}

async function assertAdmin(transaction, adminUserId) {
  const admin = await transaction.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  if (admin?.role !== "ADMIN") {
    throw new AdminOrderingMutationError("Admin authorization is required.", 403);
  }
}

async function ensureSetting(transaction, adminUserId) {
  return transaction.orderingSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", changedById: adminUserId },
    select: { id: true },
  });
}

export async function executeAdminOrderingMutation({
  prismaClient,
  adminUserId,
  mutation,
}) {
  return prismaClient.$transaction(async (transaction) => {
    await assertAdmin(transaction, adminUserId);
    await ensureSetting(transaction, adminUserId);
    const { action, data } = mutation;

    if (action === ORDERING_ADMIN_ACTION.SAVE_SCHEDULE) {
      await transaction.orderingScheduleWindow.deleteMany({
        where: { orderingSettingId: "default" },
      });

      if (data.windows.length > 0) {
        await transaction.orderingScheduleWindow.createMany({
          data: data.windows.map((window) => ({
            ...window,
            orderingSettingId: "default",
          })),
        });
      }

      await transaction.orderingSetting.update({
        where: { id: "default" },
        data: { changedById: adminUserId },
      });
      return { action, windowCount: data.windows.length };
    }

    if (action === ORDERING_ADMIN_ACTION.SET_OVERRIDE) {
      await transaction.orderingSetting.update({
        where: { id: "default" },
        data: {
          overrideMode: data.mode,
          overrideExpiresAt: data.expiresAt,
          changedById: adminUserId,
        },
      });
      return { action, mode: data.mode };
    }

    if (action === ORDERING_ADMIN_ACTION.CLEAR_OVERRIDE) {
      await transaction.orderingSetting.update({
        where: { id: "default" },
        data: {
          overrideMode: "NONE",
          overrideExpiresAt: null,
          changedById: adminUserId,
        },
      });
      return { action };
    }

    if (
      action === ORDERING_ADMIN_ACTION.PAUSE ||
      action === ORDERING_ADMIN_ACTION.RESUME
    ) {
      await transaction.orderingSetting.update({
        where: { id: "default" },
        data: {
          emergencyPaused: action === ORDERING_ADMIN_ACTION.PAUSE,
          changedById: adminUserId,
        },
      });
      return { action };
    }

    throw new AdminOrderingMutationError("The ordering operation is not supported.", 400);
  });
}
