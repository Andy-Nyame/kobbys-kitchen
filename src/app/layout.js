import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);

export const metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Kobby’s Kitchen",
    template: "%s | Kobby’s Kitchen",
  },
  description: "Tasty and satisfying meals in Tema Community Two.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <SiteHeader />
          <div className="site-main">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
