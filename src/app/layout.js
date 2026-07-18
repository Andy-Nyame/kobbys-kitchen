import { Analytics } from "@vercel/analytics/next";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getMetadataBaseUrl } from "@/lib/site";

import "./globals.css";

const metadataBaseUrl = getMetadataBaseUrl();

export const metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: "Kobby’s Kitchen",
  description: "Tasty and satisfying meals in Tema Community Two.",
  openGraph: {
    type: "website",
    siteName: "Kobby’s Kitchen",
    title: "Kobby’s Kitchen | Fast Food in Tema Community Two",
    description: "Tasty and satisfying meals in Tema Community Two.",
    images: [
      {
        url: "/images/food/fresh-meals-and-takeaway.png",
        alt: "Fresh meals and takeaway from Kobby’s Kitchen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kobby’s Kitchen | Fast Food in Tema Community Two",
    description: "Tasty and satisfying meals in Tema Community Two.",
    images: ["/images/food/fresh-meals-and-takeaway.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/images/brand/kobbys-logo.png",
  },
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
        <Analytics />
      </body>
    </html>
  );
}
