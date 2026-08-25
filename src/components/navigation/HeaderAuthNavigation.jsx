import NavigationLink from "@/components/navigation/NavigationLink";
import CustomerAccountMenu from "@/components/navigation/CustomerAccountMenu";

export default function HeaderAuthNavigation({
  navigation,
  mobile = false,
  includeAccount = true,
  includeLinks = true,
}) {
  const linkClassName = mobile
    ? "mobile-navigation__link"
    : "navigation-link";
  const activeClassName = mobile
    ? "mobile-navigation__link--current"
    : "navigation-link--current";
  const accountLinks = navigation.accountMenu?.links || [];

  return (
    <>
      {!mobile && includeAccount && navigation.accountMenu ? (
        <li>
          <CustomerAccountMenu menu={navigation.accountMenu} />
        </li>
      ) : null}
      {mobile
        ? accountLinks.map((item) => (
            <li key={item.href}>
              <NavigationLink
                activeClassName={activeClassName}
                className={`${linkClassName} ${linkClassName}--account`}
                closeDetailsOnClick
                href={item.href}
              >
                {item.label}
              </NavigationLink>
            </li>
          ))
        : null}
      {includeLinks
        ? navigation.links.map((item) => (
            <li key={item.href}>
              <NavigationLink
                activeClassName={activeClassName}
                className={`${linkClassName} ${linkClassName}--auth`}
                closeDetailsOnClick={mobile}
                href={item.href}
              >
                {item.label}
              </NavigationLink>
            </li>
          ))
        : null}
      {(includeAccount && navigation.showSignOut) ||
      (mobile && navigation.accountMenu) ? (
        <li>
          <form action="/api/auth/logout" method="POST">
            <button
              className={`${linkClassName} ${linkClassName}--button`}
              type="submit"
            >
              Sign Out
            </button>
          </form>
        </li>
      ) : null}
    </>
  );
}
