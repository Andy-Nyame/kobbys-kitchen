export const CAMPAIGN_POPUP_FREQUENCIES = Object.freeze([
  "EVERY_VISIT",
  "ONCE_PER_SESSION",
  "ONCE_PER_CUSTOMER",
]);

const SAFE_IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;

export function isSafeCampaignDestination(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return false;
  }

  if (/[\\\u0000-\u001f]/.test(value)) {
    return false;
  }

  try {
    const parsed = new URL(value, "https://kobbys-kitchen.invalid");
    return parsed.origin === "https://kobbys-kitchen.invalid";
  } catch {
    return false;
  }
}

export function isSafeCampaignImagePath(value) {
  return (
    typeof value === "string" &&
    value.startsWith("/images/") &&
    !value.startsWith("//") &&
    !/[\\\u0000-\u001f]/.test(value) &&
    SAFE_IMAGE_EXTENSION.test(value)
  );
}

export function isCampaignEligible(campaign, { now = new Date(), placement } = {}) {
  if (!campaign?.active || !(now instanceof Date) || Number.isNaN(now.getTime())) {
    return false;
  }

  const startAt = campaign.startAt ? new Date(campaign.startAt) : null;
  const endAt = campaign.endAt ? new Date(campaign.endAt) : null;

  if (startAt && (Number.isNaN(startAt.getTime()) || now < startAt)) return false;
  if (endAt && (Number.isNaN(endAt.getTime()) || now > endAt)) return false;
  if (placement === "slideshow" && campaign.slideshowEnabled !== true) return false;
  if (placement === "popup" && campaign.popupEnabled !== true) return false;

  return true;
}

export function sortCampaignsByPriority(campaigns = []) {
  return [...campaigns].sort((left, right) => {
    const priorityDifference = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDifference !== 0) return priorityDifference;

    const leftCreatedAt = new Date(left.createdAt || 0).getTime();
    const rightCreatedAt = new Date(right.createdAt || 0).getTime();
    return rightCreatedAt - leftCreatedAt;
  });
}

export function filterEligibleCampaigns(campaigns, options) {
  return sortCampaignsByPriority(
    (Array.isArray(campaigns) ? campaigns : []).filter((campaign) =>
      isCampaignEligible(campaign, options)
    )
  );
}

export function getCampaignCreative(campaign, { mobile = false } = {}) {
  if (mobile && campaign?.mobileImagePath) {
    return {
      path: campaign.mobileImagePath,
      width: campaign.mobileImageWidth,
      height: campaign.mobileImageHeight,
    };
  }

  return {
    path: campaign?.desktopImagePath,
    width: campaign?.desktopImageWidth,
    height: campaign?.desktopImageHeight,
  };
}

export function serializeCampaign(campaign) {
  return {
    ...campaign,
    startAt: campaign.startAt?.toISOString() || null,
    endAt: campaign.endAt?.toISOString() || null,
    createdAt: campaign.createdAt?.toISOString() || null,
    updatedAt: campaign.updatedAt?.toISOString() || null,
  };
}
