import { footerSupportNavigation, primaryNavigation } from "@/data/navigation";
import { getPublicSiteUrl } from "@/lib/site";

export default function sitemap() {
  const siteUrl = getPublicSiteUrl();

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
