import Link from "next/link";

import {
  footerSupportNavigation,
  primaryNavigation,
} from "@/data/navigation";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Link className="brand brand--footer" href="/">
            <span className="brand__name">Kobby’s Kitchen</span>
          </Link>
          <p className="site-footer__copy">
            The footer keeps the primary routes consistent while linking to
            supporting pages separately.
          </p>
        </div>

        <nav aria-label="Footer primary navigation">
          <h2 className="site-footer__heading">Primary Navigation</h2>
          <ul className="footer-link-list">
            {primaryNavigation.map((item) => (
              <li key={item.href}>
                <Link className="footer-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer supporting navigation">
          <h2 className="site-footer__heading">Supporting Links</h2>
          <ul className="footer-link-list">
            {footerSupportNavigation.map((item) => (
              <li key={item.href}>
                <Link className="footer-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
