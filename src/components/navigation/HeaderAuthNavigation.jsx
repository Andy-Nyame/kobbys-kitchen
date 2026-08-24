import NavigationLink from "@/components/navigation/NavigationLink";

export default function HeaderAuthNavigation({ navigation, mobile = false }) {
  const linkClassName = mobile
    ? "mobile-navigation__link"
    : "navigation-link";
  const activeClassName = mobile
    ? "mobile-navigation__link--current"
    : "navigation-link--current";

  return (
    <>
      {navigation.links.map((item) => (
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
      ))}
      {navigation.showSignOut ? (
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
