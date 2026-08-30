"use client";

import NavigationLink from "@/components/navigation/NavigationLink";
import { useLiveCustomerOrderOverview } from "@/components/operations/OperationalStatusProvider";

export default function CustomerOrdersNavigationLink({
  activeOrderCount = 0,
  mobile = false,
}) {
  const liveOverview = useLiveCustomerOrderOverview();
  const resolvedCount = liveOverview?.totalCount ?? activeOrderCount;
  const count = Number.isInteger(resolvedCount) && resolvedCount > 0
    ? resolvedCount
    : 0;
  const visibleCount = count > 99 ? "99+" : count;
  const className = mobile ? "mobile-navigation__link" : "navigation-link";
  const activeClassName = mobile
    ? "mobile-navigation__link--current"
    : "navigation-link--current";

  return (
    <NavigationLink
      activeClassName={activeClassName}
      className={`${className} orders-navigation-link`}
      closeDetailsOnClick={mobile}
      href="/account/orders"
    >
      <span>Orders</span>
      {count > 0 ? (
        <>
          <span aria-hidden="true" className="orders-navigation-badge">
            {visibleCount}
          </span>
          <span className="sr-only">
            {count} active order{count === 1 ? "" : "s"}
          </span>
        </>
      ) : null}
    </NavigationLink>
  );
}
