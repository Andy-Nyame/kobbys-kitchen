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
  Object.freeze({ label: "Cart", href: "/cart" }),
]);

const ADMIN_ACCOUNT_LINKS = Object.freeze([
  Object.freeze({ label: "Admin Dashboard", href: "/admin" }),
  Object.freeze({ label: "Admin Profile", href: "/admin/profile" }),
]);

const CHEF_ACCOUNT_LINKS = Object.freeze([
  Object.freeze({ label: "Kitchen Workspace", href: "/kitchen" }),
]);

function getAccountMenu(user, profile, role) {
  const displayName = getCustomerDisplayName(user, profile);
  const isAdmin = role === "ADMIN";
  const isChef = role === "CHEF";

  return {
    displayName:
      isAdmin && displayName === "Customer" ? "Administrator" : displayName,
    email: user.email || "",
    avatar: getCustomerAvatar(user, profile),
    links: isAdmin ? ADMIN_ACCOUNT_LINKS : isChef ? CHEF_ACCOUNT_LINKS : CUSTOMER_ACCOUNT_LINKS,
    navigationLabel: isAdmin ? "Administrator account" : isChef ? "Kitchen account" : "Customer account",
    triggerLabel: isAdmin ? "Open administrator account menu" : isChef ? "Open kitchen account menu" : "Open account menu",
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

  if (role === "CHEF") {
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
