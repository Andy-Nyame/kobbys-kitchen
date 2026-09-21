import { prisma } from "@/lib/prisma";
import { executeAdminCampaignMutation } from "@/lib/campaigns/admin-mutations";

export function mutateAdminCampaign({ adminUserId, mutation }) {
  return executeAdminCampaignMutation({
    prismaClient: prisma,
    adminUserId,
    mutation,
  });
}
