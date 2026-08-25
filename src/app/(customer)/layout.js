import { redirect } from "next/navigation";

import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
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
    <>
      <SiteHeader />
      <div className="site-main">
        <main className="page">
          <div className="container content-stack">{children}</div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
