function getSafeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getCustomerDisplayName(user, profile = null) {
  const candidate =
    profile?.display_name ||
    profile?.displayName ||
    user?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "";

  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim().slice(0, 80)
    : "Customer";
}

export function getCustomerInitials(displayName) {
  const words = String(displayName || "").match(/[\p{L}\p{N}]+/gu) || [];

  if (words.length === 0 || displayName === "Customer") {
    return null;
  }

  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toLocaleUpperCase())
    .join("");
}

export function getCustomerAvatar(user, profile = null) {
  const googleIdentity = user?.identities?.find(
    (identity) => identity.provider === "google"
  );
  const googleData = googleIdentity?.identity_data || {};
  const userMetadata = user?.user_metadata || {};
  const imageUrl = [
    user?.image,
    profile?.image_url,
    profile?.imageUrl,
    googleData.avatar_url,
    googleData.picture,
    userMetadata.avatar_url,
    userMetadata.picture,
  ]
    .map(getSafeImageUrl)
    .find(Boolean);
  const displayName = getCustomerDisplayName(user, profile);

  return {
    imageUrl: imageUrl || null,
    initials: getCustomerInitials(displayName),
  };
}
