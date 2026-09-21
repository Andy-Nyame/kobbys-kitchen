import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import MobileCartCta from "@/components/cart/MobileCartCta";
import CampaignPopup from "@/components/campaigns/CampaignPopup";
import OperationalStatusProvider from "@/components/operations/OperationalStatusProvider";
import { getCustomerAccess } from "@/lib/auth/guards";
import { getPublicCartCatalogueItems } from "@/lib/menu/catalogue";
import { getPopupCampaign } from "@/lib/campaigns/server";

export default async function MarketingLayout({ children }) {
  const [{ user, role }, cartCatalogueItems, popupCampaign] = await Promise.all([
    getCustomerAccess(),
    getPublicCartCatalogueItems(),
    getPopupCampaign().catch((error) => {
      console.error("[campaign-popup]", {
        reason: error?.code || "query_failed",
      });
      return null;
    }),
  ]);
  const exactPaths = role === "CUSTOMER"
    ? ["/", "/menu", "/cart", "/order"]
    : ["/menu", "/cart", "/order"];

  return (
    <OperationalStatusProvider exactPaths={exactPaths}>
      <SiteHeader />
      <div className="site-main">{children}</div>
      <SiteFooter />
      <MobileCartCta catalogueItems={cartCatalogueItems} />
      <CampaignPopup campaign={popupCampaign} viewerKey={user?.id || null} />
    </OperationalStatusProvider>
  );
}
