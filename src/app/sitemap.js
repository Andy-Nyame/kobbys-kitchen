import { footerSupportNavigation, primaryNavigation } from "@/data/navigation";

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return null;
}

export default function sitemap() {
  const siteUrl = getSiteUrl();

  if (!siteUrl) {
    return [];
  }

  const routes = [
    ...primaryNavigation.map((item) => item.href),
    ...footerSupportNavigation.map((item) => item.href),
  ];

  return routes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified: new Date(),
  }));
}
