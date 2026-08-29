import { getAdminLoginPath } from "./redirects.js";

export function getAdminAuthorization(user, role, intendedPath = "/admin") {
  if (!user) {
    return {
      allowed: false,
      reason: "SIGNED_OUT",
      redirectTo: getAdminLoginPath(intendedPath),
    };
  }

  if (role !== "ADMIN") {
    return {
      allowed: false,
      reason: "FORBIDDEN",
      redirectTo: "/access-denied?area=admin",
    };
  }

  return { allowed: true, reason: null, redirectTo: null };
}
