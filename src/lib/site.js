function isValidHttpUrl(value) {
  try {
    const parsedUrl = new URL(value);
    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function normalizeSiteUrl(value) {
  return value ? value.replace(/\/+$/, "") : null;
}

export function getPublicSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  ].filter(Boolean);

  const siteUrl = candidates.find(isValidHttpUrl);
  return normalizeSiteUrl(siteUrl || null);
}
