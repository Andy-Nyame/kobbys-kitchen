import NavigationLink from "@/components/navigation/NavigationLink";

const adminNavigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNavigation() {
  return (
    <nav className="admin-navigation" aria-label="Admin navigation">
      <ul className="admin-navigation__list">
        {adminNavigation.map((item) => (
          <li key={item.href}>
            <NavigationLink
              href={item.href}
              className="admin-navigation__link"
              activeClassName="admin-navigation__link--current"
            >
              {item.label}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
