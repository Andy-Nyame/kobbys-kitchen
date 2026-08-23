import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export default function MarketingLayout({ children }) {
  return (
    <>
      <SiteHeader />
      <div className="site-main">{children}</div>
      <SiteFooter />
    </>
  );
}
