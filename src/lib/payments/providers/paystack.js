import crypto from "node:crypto";

import { PaymentDomainError } from "../domain.js";

const PAYSTACK_API = "https://api.paystack.co";

function secretKey() {
  const value = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!value) {
    throw new PaymentDomainError(
      "PAYSTACK_UNAVAILABLE",
      "Online payment is not configured.",
      503
    );
  }
  return value;
}

async function requestPaystack(path, options = {}, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`${PAYSTACK_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new PaymentDomainError(
      "PAYSTACK_NETWORK_ERROR",
      "The payment provider could not be reached. Please try again.",
      503
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.status) {
    throw new PaymentDomainError(
      "PAYSTACK_REQUEST_FAILED",
      "The payment provider could not complete this request.",
      502
    );
  }
  return body.data;
}

export async function initializePaystackTransaction(payload, fetchImpl) {
  const data = await requestPaystack(
    "/transaction/initialize",
    { method: "POST", body: JSON.stringify(payload) },
    fetchImpl
  );
  const authorizationUrl = data?.authorization_url;
  let authorizationHost = "";
  let authorizationProtocol = "";
  try {
    const parsedAuthorizationUrl = new URL(authorizationUrl);
    authorizationHost = parsedAuthorizationUrl.hostname;
    authorizationProtocol = parsedAuthorizationUrl.protocol;
  } catch {
    // The validation below returns a safe provider-response error.
  }
  if (
    typeof authorizationUrl !== "string" ||
    authorizationProtocol !== "https:" ||
    (authorizationHost !== "paystack.com" && !authorizationHost.endsWith(".paystack.com")) ||
    data.reference !== payload.reference
  ) {
    throw new PaymentDomainError(
      "PAYSTACK_RESPONSE_INVALID",
      "The payment provider returned an invalid checkout response.",
      502
    );
  }
  return { authorizationUrl, reference: data.reference, accessCode: data.access_code };
}

export function verifyPaystackTransaction(reference, fetchImpl) {
  return requestPaystack(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
    fetchImpl
  );
}

export function createPaystackRefund(reference, reason, fetchImpl) {
  return requestPaystack(
    "/refund",
    {
      method: "POST",
      body: JSON.stringify({
        transaction: reference,
        merchant_note: reason,
        customer_note: "Full refund for a cancelled Kobby's Kitchen order",
      }),
    },
    fetchImpl
  );
}

export function verifyPaystackWebhookSignature(rawBody, signature) {
  if (!signature || typeof rawBody !== "string") return false;
  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");
  const actual = String(signature).trim().toLowerCase();
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
