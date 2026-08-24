const SIGNED_OUT_LINKS = Object.freeze([
  Object.freeze({ label: "Login", href: "/login" }),
]);

const CUSTOMER_LINKS = Object.freeze([
  Object.freeze({ label: "My Account", href: "/account" }),
]);

const ADMIN_LINKS = Object.freeze([
  Object.freeze({ label: "Admin Dashboard", href: "/admin" }),
]);

export function getHeaderAuthNavigation(user, role) {
  if (!user) {
    return {
      links: SIGNED_OUT_LINKS,
      showSignOut: false,
    };
  }

  if (role === "CUSTOMER") {
    return {
      links: CUSTOMER_LINKS,
      showSignOut: false,
    };
  }

  if (role === "ADMIN") {
    return {
      links: ADMIN_LINKS,
      showSignOut: false,
    };
  }

  return {
    links: [],
    showSignOut: true,
  };
}
