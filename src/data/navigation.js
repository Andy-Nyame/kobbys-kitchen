export const primaryNavigation = [
  { label: "Home", href: "/" },
  { label: "Menu", href: "/menu" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Reviews", href: "/reviews" },
];

export const footerSupportNavigation = [
  { label: "Suggestions", href: "/suggestions" },
  { label: "Privacy", href: "/privacy" },
];

export const accountNavigation = [
  { href: "/account", label: "Overview" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
];

export const orderingNavigation = {
  label: "Order Now",
  href: "/order",
};

export const authCrossLinks = {
  login: {
    prompt: "Don’t have an account?",
    label: "Create one",
    href: "/signup",
  },
  signup: {
    prompt: "Already have an account?",
    label: "Log in",
    href: "/login",
  },
};
