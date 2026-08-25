import { createHmac, timingSafeEqual } from "node:crypto";

export const PASSWORD_RECOVERY_COOKIE = "kk_password_recovery";
const PASSWORD_RECOVERY_TTL_SECONDS = 15 * 60;

function getTrustedOrigin(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getPasswordRecoveryRedirectUrl({
  requestUrl,
  environment = process.env.APP_ENV,
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL,
}) {
  const requestOrigin = getTrustedOrigin(requestUrl);
  const configuredOrigin = getTrustedOrigin(configuredSiteUrl);

  // Local development must return to the app instance that received the
  // request. This avoids a stale localhost:3000 setting breaking a server
  // running on another local port.
  const origin =
    environment === "development"
      ? requestOrigin
      : configuredOrigin || requestOrigin;

  if (!origin) {
    throw new Error("invalid_password_recovery_redirect_origin");
  }

  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/reset-password");

  return callbackUrl.toString();
}

function getRecoverySignature(userId, expiresAt, secret) {
  return createHmac("sha256", secret)
    .update(`${userId}.${expiresAt}`)
    .digest("base64url");
}

export function createPasswordRecoveryProof(userId, secret, now = Date.now()) {
  if (!userId || !secret) {
    return "";
  }

  const expiresAt = Math.floor(now / 1000) + PASSWORD_RECOVERY_TTL_SECONDS;
  const signature = getRecoverySignature(userId, expiresAt, secret);

  return `${userId}.${expiresAt}.${signature}`;
}

export function hasValidPasswordRecoveryProof(
  proof,
  userId,
  secret,
  now = Date.now()
) {
  if (!proof || !userId || !secret) {
    return false;
  }

  const parts = proof.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [proofUserId, expiresAtValue, signature] = parts;
  const expiresAt = Number(expiresAtValue);

  if (
    proofUserId !== userId ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < Math.floor(now / 1000) ||
    !signature
  ) {
    return false;
  }

  const expectedSignature = getRecoverySignature(userId, expiresAt, secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

export function getPasswordRecoveryCookieOptions() {
  return {
    httpOnly: true,
    maxAge: PASSWORD_RECOVERY_TTL_SECONDS,
    path: "/api/auth/reset-password",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
