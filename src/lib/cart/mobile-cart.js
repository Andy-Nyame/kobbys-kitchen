const SUPPRESSED_CART_CTA_PATHS = new Set(["/cart", "/checkout"]);
const SUPPRESSED_CART_CTA_PREFIXES = Object.freeze([
  "/account",
  "/admin",
  "/auth",
  "/forgot-password",
  "/kitchen",
  "/login",
  "/payment",
  "/reset-password",
  "/signup",
]);

export function isMobileCartCtaSuppressedPath(pathname) {
  if (typeof pathname !== "string") {
    return true;
  }

  if (SUPPRESSED_CART_CTA_PATHS.has(pathname)) {
    return true;
  }

  return SUPPRESSED_CART_CTA_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function shouldShowMobileCartCta(pathname, itemCount) {
  return (
    Number.isInteger(itemCount) &&
    itemCount > 0 &&
    !isMobileCartCtaSuppressedPath(pathname)
  );
}
