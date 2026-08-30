import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import OperationalStatusProvider from "@/components/operations/OperationalStatusProvider";
import { getCustomerAccess } from "@/lib/auth/guards";

export default async function MarketingLayout({ children }) {
  const { role } = await getCustomerAccess();
  const exactPaths = role === "CUSTOMER"
    ? ["/", "/menu", "/cart", "/order"]
    : ["/menu", "/cart", "/order"];

  return (
    <OperationalStatusProvider exactPaths={exactPaths}>
      <SiteHeader />
      <div className="site-main">{children}</div>
      <SiteFooter />
    </OperationalStatusProvider>
  );
}
