import { redirect } from "next/navigation";

import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import OperationalStatusProvider from "@/components/operations/OperationalStatusProvider";
import { getCustomerAccess } from "@/lib/auth/guards";

export default async function CustomerLayout({ children }) {
  const { user, role } = await getCustomerAccess();

  if (user && role !== "CUSTOMER") {
    redirect("/");
  }

  if (!user) {
    return children;
  }

  return (
    <OperationalStatusProvider
      exactPaths={["/checkout", "/account/orders"]}
      prefixPaths={["/account/orders/"]}
      refreshServerExactPaths={["/account/orders"]}
      refreshServerPrefixPaths={["/account/orders/"]}
    >
      <SiteHeader />
      <div className="site-main">
        <main className="page">
          <div className="container content-stack">{children}</div>
        </main>
      </div>
      <SiteFooter />
    </OperationalStatusProvider>
  );
}
