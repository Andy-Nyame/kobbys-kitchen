import NavigationLink from "@/components/navigation/NavigationLink";
import { accountNavigation } from "@/data/navigation";

export default function AccountNavigation() {
  return (
    <nav className="account-navigation" aria-label="Account navigation">
      <ul className="navigation-list">
        {accountNavigation.map((item) => (
          <li key={item.href}>
            <NavigationLink
              href={item.href}
              className="navigation-link"
              activeClassName="navigation-link--current"
            >
              {item.label}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
