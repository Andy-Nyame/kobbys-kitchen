import { prisma } from "@/lib/prisma";
import { serializeCampaign } from "@/lib/campaigns/domain";

const publicCampaignSelect = Object.freeze({
  id: true,
  name: true,
  headline: true,
  altText: true,
  priority: true,
  desktopImagePath: true,
  desktopImageWidth: true,
  desktopImageHeight: true,
  mobileImagePath: true,
  mobileImageWidth: true,
  mobileImageHeight: true,
  destinationPath: true,
  slideshowEnabled: true,
  popupEnabled: true,
  popupFrequency: true,
  dismissible: true,
  startAt: true,
  endAt: true,
  createdAt: true,
  updatedAt: true,
});

function eligibleWhere(now, placement) {
  return {
    active: true,
    ...(placement === "slideshow" ? { slideshowEnabled: true } : {}),
    ...(placement === "popup" ? { popupEnabled: true } : {}),
    AND: [
      { OR: [{ startAt: null }, { startAt: { lte: now } }] },
      { OR: [{ endAt: null }, { endAt: { gte: now } }] },
    ],
  };
}

export async function getEligibleCampaigns({ now = new Date(), placement }) {
  const campaigns = await prisma.campaign.findMany({
    where: eligibleWhere(now, placement),
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    select: publicCampaignSelect,
  });

  return campaigns.map(serializeCampaign);
}

export async function getHomepageCampaigns(options = {}) {
  return getEligibleCampaigns({ ...options, placement: "slideshow" });
}

export async function getPopupCampaign(options = {}) {
  const campaigns = await prisma.campaign.findMany({
    where: eligibleWhere(options.now || new Date(), "popup"),
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: publicCampaignSelect,
  });

  return campaigns[0] ? serializeCampaign(campaigns[0]) : null;
}

export async function getAdminCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return campaigns.map(serializeCampaign);
}
