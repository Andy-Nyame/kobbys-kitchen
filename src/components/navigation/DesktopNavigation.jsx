import Link from "next/link";

import { primaryNavigation } from "@/data/navigation";

export default function DesktopNavigation() {
  return (
    <nav className="desktop-navigation" aria-label="Primary navigation">
      <ul className="navigation-list">
        {primaryNavigation.map((item) => (
          <li key={item.href}>
            <Link className="navigation-link" href={item.href}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
