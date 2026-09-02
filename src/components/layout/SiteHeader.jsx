import Image from "next/image";
import Link from "next/link";

import DesktopNavigation from "@/components/navigation/DesktopNavigation";
import HeaderAuthNavigation from "@/components/navigation/HeaderAuthNavigation";
import MobileNavigation from "@/components/navigation/MobileNavigation";
import CartLink from "@/components/cart/CartLink";
import ThemeControl from "@/components/theme/ThemeControl";
import { businessData } from "@/data/businessData";
import { getHeaderAuthNavigation } from "@/lib/auth/header-navigation";
import {
  ensureCustomerProfile,
  getCustomerAccess,
  getUserProfile,
} from "@/lib/auth/guards";
import { getCustomerActiveOrderOverview } from "@/lib/orders/customer-orders";

export default async function SiteHeader() {
  let user = null;
  let role = null;
  let profile = null;
  let customerOrdersNavigation = null;

  try {
    ({ user, role } = await getCustomerAccess());

    if (role === "CUSTOMER") {
      customerOrdersNavigation = { activeOrderCount: 0 };
      profile = await ensureCustomerProfile(user);

      try {
        const overview = await getCustomerActiveOrderOverview(user.id, {
          limit: 0,
        });
        customerOrdersNavigation.activeOrderCount = overview.totalCount;
      } catch (error) {
        console.error("[site-header-active-orders]", {
          reason: error?.code || "query_failed",
        });
      }
    } else if (role === "ADMIN" || role === "CHEF") {
      profile = await getUserProfile(user.id);
    }
  } catch (error) {
    if (error?.reason) {
      console.error("[site-header-auth]", { reason: error.reason });
    }
  }

  const authNavigation = getHeaderAuthNavigation(user, role, profile);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/">
          <Image
            className="brand__image"
            src="/images/brand/kobbys-logo.png"
            alt="Kobby’s Kitchen logo"
            width={673}
            height={767}
          />
          <span className="brand__copy">
            <span className="brand__name">{businessData.name}</span>
            <span className="brand__tagline">{businessData.location.area}</span>
          </span>
        </Link>

        <div className="site-header__desktop-actions">
          <DesktopNavigation
            customerOrdersNavigation={customerOrdersNavigation}
          />
          <ThemeControl compact />
          {authNavigation.links.length > 0 ? (
            <ul className="site-header__auth-actions">
              <HeaderAuthNavigation
                includeAccount={false}
                navigation={authNavigation}
              />
            </ul>
          ) : null}
          <CartLink />
          {authNavigation.accountMenu || authNavigation.showSignOut ? (
            <ul className="site-header__account-actions">
              <HeaderAuthNavigation
                includeLinks={false}
                navigation={authNavigation}
              />
            </ul>
          ) : null}
        </div>

        <div className="site-header__mobile-actions">
          <CartLink mobileHeader />
          <MobileNavigation
            authNavigation={authNavigation}
            customerOrdersNavigation={customerOrdersNavigation}
          />
        </div>
      </div>
    </header>
  );
}
