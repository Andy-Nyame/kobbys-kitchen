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

export function getHeaderAuthNavigation(user, role, profile = null) {
  if (!user) {
    return {
      links: SIGNED_OUT_LINKS,
      accountMenu: null,
      showSignOut: false,
    };
  }

  if (role === "CUSTOMER") {
    const displayName = getCustomerDisplayName(user, profile);

    return {
      links: [],
      accountMenu: {
        displayName,
        email: user.email || "",
        avatar: getCustomerAvatar(user, profile),
        links: CUSTOMER_ACCOUNT_LINKS,
      },
      showSignOut: false,
    };
  }

  if (role === "ADMIN") {
    return {
      links: [],
      accountMenu: null,
      showSignOut: false,
    };
  }

  return {
    links: [],
    accountMenu: null,
    showSignOut: true,
  };
}
