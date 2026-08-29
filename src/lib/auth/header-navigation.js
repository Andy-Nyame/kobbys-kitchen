import {
  getCustomerAvatar,
  getCustomerDisplayName,
} from "./customer-avatar.js";

const SIGNED_OUT_LINKS = Object.freeze([
  Object.freeze({ label: "Login", href: "/login" }),
]);

const CUSTOMER_ACCOUNT_LINKS = Object.freeze([
  Object.freeze({ label: "Profile", href: "/account/profile" }),
  Object.freeze({ label: "My Orders", href: "/account/orders" }),
]);

const ADMIN_ACCOUNT_LINKS = Object.freeze([
  Object.freeze({ label: "Admin Dashboard", href: "/admin" }),
  Object.freeze({ label: "Admin Profile", href: "/admin/profile" }),
]);

function getAccountMenu(user, profile, role) {
  const displayName = getCustomerDisplayName(user, profile);
  const isAdmin = role === "ADMIN";

  return {
    displayName:
      isAdmin && displayName === "Customer" ? "Administrator" : displayName,
    email: user.email || "",
    avatar: getCustomerAvatar(user, profile),
    links: isAdmin ? ADMIN_ACCOUNT_LINKS : CUSTOMER_ACCOUNT_LINKS,
    navigationLabel: isAdmin
      ? "Administrator account"
      : "Customer account",
    triggerLabel: isAdmin
      ? "Open administrator account menu"
      : "Open account menu",
  };
}

export function getHeaderAuthNavigation(user, role, profile = null) {
  if (!user) {
    return {
      links: SIGNED_OUT_LINKS,
      accountMenu: null,
      showSignOut: false,
    };
  }

  if (role === "CUSTOMER") {
    return {
      links: [],
      accountMenu: getAccountMenu(user, profile, role),
      showSignOut: false,
    };
  }

  if (role === "ADMIN") {
    return {
      links: [],
      accountMenu: getAccountMenu(user, profile, role),
      showSignOut: false,
    };
  }

  return {
    links: [],
    accountMenu: null,
    showSignOut: true,
  };
}
