import Image from "next/image";
import Link from "next/link";

import DesktopNavigation from "@/components/navigation/DesktopNavigation";
import HeaderAuthNavigation from "@/components/navigation/HeaderAuthNavigation";
import MobileNavigation from "@/components/navigation/MobileNavigation";
import CartLink from "@/components/cart/CartLink";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeControl from "@/components/theme/ThemeControl";
import { businessData } from "@/data/businessData";
import { getHeaderAuthNavigation } from "@/lib/auth/header-navigation";
import {
  ensureCustomerProfile,
  getCustomerAccess,
  getUserProfile,
} from "@/lib/auth/guards";
import { getCustomerActiveOrderOverview } from "@/lib/orders/customer-orders";
import { IMPORTANT_CUSTOMER_NOTIFICATION_TYPES } from "@/lib/notifications/domain";
import { getNotificationSnapshot } from "@/lib/notifications/queries";

export default async function SiteHeader() {
  let user = null;
  let role = null;
  let profile = null;
  let customerOrdersNavigation = null;
  let notificationSnapshot = null;

  try {
    ({ user, role } = await getCustomerAccess());

    if (role === "CUSTOMER") {
      customerOrdersNavigation = { activeOrderCount: 0 };
      notificationSnapshot = { notifications: [], unreadCount: 0 };
      profile = await ensureCustomerProfile(user);

      try {
        const [overviewResult, notificationResult] = await Promise.allSettled([
          getCustomerActiveOrderOverview(user.id, { limit: 0 }),
          getNotificationSnapshot(user.id),
        ]);
        if (overviewResult.status === "fulfilled") {
          customerOrdersNavigation.activeOrderCount = overviewResult.value.totalCount;
        }
        if (notificationResult.status === "fulfilled") {
          notificationSnapshot = notificationResult.value;
        }
        if (overviewResult.status === "rejected" || notificationResult.status === "rejected") {
          throw overviewResult.reason || notificationResult.reason;
        }
      } catch (error) {
        console.error("[site-header-customer-data]", {
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

        {notificationSnapshot ? (
          <div className="site-header__notification">
            <NotificationBell
              initialSnapshot={notificationSnapshot}
              toastTypes={IMPORTANT_CUSTOMER_NOTIFICATION_TYPES}
            />
          </div>
        ) : null}

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
