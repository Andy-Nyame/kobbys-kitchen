import NavigationLink from "@/components/navigation/NavigationLink";

const adminNavigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/operations", label: "Operations" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNavigation({ closeDetailsOnClick = false, pendingOrderCount = 0 }) {
  return (
    <nav className="admin-navigation" aria-label="Admin navigation">
      <ul className="admin-navigation__list">
        {adminNavigation.map((item) => (
          <li key={item.href}>
            <NavigationLink
              href={item.href}
              className="admin-navigation__link"
              activeClassName="admin-navigation__link--current"
              closeDetailsOnClick={closeDetailsOnClick}
            >
              <span>{item.label}</span>
              {item.href === "/admin/orders" && pendingOrderCount > 0 ? (
                <span
                  aria-label={`${pendingOrderCount} new order${pendingOrderCount === 1 ? "" : "s"}`}
                  className="admin-navigation__badge"
                >
                  {pendingOrderCount > 99 ? "99+" : pendingOrderCount}
                </span>
              ) : null}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
