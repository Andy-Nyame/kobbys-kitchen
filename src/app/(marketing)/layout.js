import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import MobileCartCta from "@/components/cart/MobileCartCta";
import OperationalStatusProvider from "@/components/operations/OperationalStatusProvider";
import { getCustomerAccess } from "@/lib/auth/guards";
import { getPublicCartCatalogueItems } from "@/lib/menu/catalogue";

export default async function MarketingLayout({ children }) {
  const [{ role }, cartCatalogueItems] = await Promise.all([
    getCustomerAccess(),
    getPublicCartCatalogueItems(),
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
    </OperationalStatusProvider>
  );
}
