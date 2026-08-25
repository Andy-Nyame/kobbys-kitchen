import { getSafeCustomerRedirectPath } from "./redirects.js";

export function getGoogleOAuthCallbackUrl(requestUrl, requestedPath) {
  const callbackUrl = new URL("/auth/callback", requestUrl);

  callbackUrl.searchParams.set("flow", "oauth");
  callbackUrl.searchParams.set(
    "next",
    getSafeCustomerRedirectPath(requestedPath)
  );

  return callbackUrl.toString();
}
