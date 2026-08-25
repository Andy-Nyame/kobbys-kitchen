export function getSafeRedirectPath(value, fallback = "/account") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, "http://local.invalid");

    if (url.origin !== "http://local.invalid") {
      return fallback;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function getSafeAdminRedirectPath(value, fallback = "/admin") {
  const safePath = getSafeRedirectPath(value, fallback);

  if (
    safePath === "/admin" ||
    safePath.startsWith("/admin/") ||
    safePath.startsWith("/admin?")
  ) {
    return safePath;
  }

  return fallback;
}

export function getSafeCustomerRedirectPath(value, fallback = "/account") {
  const safePath = getSafeRedirectPath(value, fallback);

  if (
    safePath === "/account" ||
    safePath.startsWith("/account/") ||
    safePath.startsWith("/account?")
  ) {
    return safePath;
  }

  return fallback;
}

export function getCustomerLoginPath(intendedPath = "/account") {
  const safePath = getSafeCustomerRedirectPath(intendedPath);

  if (safePath === "/account") {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(safePath)}`;
}

export function getAdminLoginPath(intendedPath = "/admin") {
  const safePath = getSafeAdminRedirectPath(intendedPath);

  if (safePath === "/admin") {
    return "/admin";
  }

  return `/admin?next=${encodeURIComponent(safePath)}`;
}
