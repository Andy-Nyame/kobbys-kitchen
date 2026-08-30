import NavigationLink from "@/components/navigation/NavigationLink";
import CustomerOrdersNavigationLink from "@/components/navigation/CustomerOrdersNavigationLink";
import { primaryNavigation } from "@/data/navigation";

export default function DesktopNavigation({ customerOrdersNavigation = null }) {
  return (
    <nav className="desktop-navigation" aria-label="Primary navigation">
      <ul className="navigation-list">
        {primaryNavigation.map((item) => (
          <li key={item.href}>
            <NavigationLink
              activeClassName="navigation-link--current"
              className="navigation-link"
              href={item.href}
            >
              {item.label}
            </NavigationLink>
          </li>
        ))}
        {customerOrdersNavigation ? (
          <li>
            <CustomerOrdersNavigationLink
              activeOrderCount={customerOrdersNavigation.activeOrderCount}
            />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
