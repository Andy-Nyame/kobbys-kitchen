import HeaderAuthNavigation from "@/components/navigation/HeaderAuthNavigation";
import CartLink from "@/components/cart/CartLink";
import NavigationLink from "@/components/navigation/NavigationLink";
import ThemeControl from "@/components/theme/ThemeControl";
import { primaryNavigation } from "@/data/navigation";

export default function MobileNavigation({ authNavigation }) {
  return (
    <details className="mobile-navigation">
      <summary
        aria-controls="mobile-navigation-menu"
        className="mobile-navigation__toggle"
      >
        <span className="mobile-navigation__label mobile-navigation__label--closed sr-only">
          Open navigation menu
        </span>
        <span className="mobile-navigation__label mobile-navigation__label--open sr-only">
          Close navigation menu
        </span>
        <span
          aria-hidden="true"
          className="mobile-navigation__icon"
        >
          <span />
          <span />
          <span />
        </span>
      </summary>

      <nav
        id="mobile-navigation-menu"
        aria-label="Mobile navigation"
        className="mobile-navigation__menu"
      >
        <ul className="mobile-navigation__list">
          {primaryNavigation.map((item) => (
            <li key={item.href}>
              <NavigationLink
                activeClassName="mobile-navigation__link--current"
                className="mobile-navigation__link"
                closeDetailsOnClick
                href={item.href}
              >
                {item.label}
              </NavigationLink>
            </li>
          ))}
          <HeaderAuthNavigation mobile navigation={authNavigation} />
        </ul>

        <div className="mobile-navigation__actions">
          <CartLink mobile />
          <ThemeControl className="mobile-navigation__theme" />
        </div>
      </nav>
    </details>
  );
}
