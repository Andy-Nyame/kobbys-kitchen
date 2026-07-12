import ButtonLink from "@/components/ui/ButtonLink";
import { businessData } from "@/data/businessData";
import { primaryNavigation } from "@/data/navigation";

export default function MobileNavigation() {
  return (
    <details className="mobile-navigation">
      <summary
        aria-controls="mobile-navigation-menu"
        aria-label="Open navigation menu"
        className="mobile-navigation__toggle"
      >
        <span className="sr-only">Open navigation menu</span>
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
              <a className="mobile-navigation__link" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="mobile-navigation__actions">
          <ButtonLink
            ariaLabel="Order on WhatsApp"
            className="mobile-navigation__whatsapp"
            href={businessData.whatsapp.href}
            rel="noopener noreferrer"
            target="_blank"
            variant="primary"
          >
            Order on WhatsApp
          </ButtonLink>
        </div>
      </nav>
    </details>
  );
}
