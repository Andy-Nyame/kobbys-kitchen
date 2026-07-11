import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import MobileActionBar from "@/components/layout/MobileActionBar";

import "./globals.css";

export const metadata = {
  title: "Kobby’s Kitchen",
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
          <MobileActionBar />
        </div>
      </body>
    </html>
  );
}
