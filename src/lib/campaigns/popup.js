const POPUP_SUPPRESSED_PATHS = new Set(["/cart", "/checkout"]);
const POPUP_SUPPRESSED_PREFIXES = Object.freeze([
  "/account/orders/",
  "/admin",
  "/api/payments",
  "/auth",
  "/kitchen",
  "/payment",
]);

export function isCampaignPopupSuppressedPath(pathname) {
  if (typeof pathname !== "string") return true;
  if (POPUP_SUPPRESSED_PATHS.has(pathname)) return true;

  return POPUP_SUPPRESSED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export function getCampaignPopupStoragePolicy(campaign, viewerKey = null) {
  if (!campaign?.id) return null;

  const baseKey = `kobbys-campaign-popup:${campaign.id}`;
  if (campaign.popupFrequency === "EVERY_VISIT") {
    return { storage: null, key: null };
  }
  if (campaign.popupFrequency === "ONCE_PER_CUSTOMER" && viewerKey) {
    return { storage: "local", key: `${baseKey}:viewer:${viewerKey}` };
  }

  return { storage: "session", key: baseKey };
}

export function shouldScheduleCampaignPopup({
  campaign,
  pathname,
  hasBeenSeen = false,
}) {
  return Boolean(campaign?.popupEnabled) && !hasBeenSeen && !isCampaignPopupSuppressedPath(pathname);
}
