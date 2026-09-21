import { CAMPAIGN_ADMIN_ACTION } from "./admin-validation.js";

export class AdminCampaignMutationError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "AdminCampaignMutationError";
    this.status = status;
  }
}

export async function executeAdminCampaignMutation({
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
      throw new AdminCampaignMutationError("Admin authorization is required.", 403);
    }
    if (mutation.action !== CAMPAIGN_ADMIN_ACTION.UPDATE) {
      throw new AdminCampaignMutationError("The campaign operation is not supported.", 400);
    }

    const existing = await transaction.campaign.findUnique({
      where: { id: mutation.campaignId },
      select: { id: true },
    });
    if (!existing) {
      throw new AdminCampaignMutationError("Campaign not found.", 404);
    }

    return transaction.campaign.update({
      where: { id: mutation.campaignId },
      data: mutation.data,
      select: {
        id: true,
        active: true,
        slideshowEnabled: true,
        popupEnabled: true,
        startAt: true,
        endAt: true,
        priority: true,
        destinationPath: true,
        popupFrequency: true,
      },
    });
  });
}
