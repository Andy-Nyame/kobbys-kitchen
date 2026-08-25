import { getSafeAdminRedirectPath } from "./redirects.js";

export const ADMIN_LOGIN_ERROR =
  "Unable to sign in to administration with those credentials.";

export function getAdminLoginDecision({ user, role, intendedPath }) {
  if (!user || role !== "ADMIN") {
    return {
      allowed: false,
      clearSession: Boolean(user),
      redirectTo: null,
    };
  }

  return {
    allowed: true,
    clearSession: false,
    redirectTo: getSafeAdminRedirectPath(intendedPath),
  };
}
