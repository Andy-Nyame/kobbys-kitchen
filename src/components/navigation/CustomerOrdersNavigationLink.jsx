import NavigationLink from "@/components/navigation/NavigationLink";

export default function CustomerOrdersNavigationLink({
  activeOrderCount = 0,
  mobile = false,
}) {
  const count = Number.isInteger(activeOrderCount) && activeOrderCount > 0
    ? activeOrderCount
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
