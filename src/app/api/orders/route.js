import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import {
  CheckoutDomainError,
  getCheckoutAuthorization,
  validateCheckoutPayload,
} from "@/lib/orders/checkout-domain";
import { createPickupOrderForCustomer } from "@/lib/orders/server";
import { getPaymentAvailability, PaymentDomainError } from "@/lib/payments/domain";

const conflictCodes = new Set([
  "ORDERING_CLOSED",
  "ITEM_REMOVED",
  "ITEM_UNAVAILABLE",
  "PRICE_TIER_INVALID",
  "PRICE_CHANGED",
]);

function errorResponse(error) {
  if (error instanceof CheckoutDomainError) {
    const status =
      error.code === "AUTHENTICATION_REQUIRED"
        ? 401
        : error.code === "CUSTOMER_REQUIRED"
          ? 403
          : conflictCodes.has(error.code)
            ? 409
            : 400;

    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        errors: error.fieldErrors,
        ...(error.details ? { details: error.details } : {}),
      },
      { status }
    );
  }

  if (error?.code === "ORDERING_CLOSED") {
    return NextResponse.json(
      {
        ok: false,
        code: "ORDERING_CLOSED",
        message: "Online ordering is currently closed. Your cart has been kept.",
        errors: {},
      },
      { status: 409 }
    );
  }

  if (error instanceof PaymentDomainError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message, errors: {} },
      { status: error.status }
    );
  }

  console.error("[pickup-order-create]", {
    reason: error?.code || "order_creation_failed",
  });
  return NextResponse.json(
    {
      ok: false,
      code: "ORDER_CREATION_FAILED",
      message: "Your order could not be placed. Your cart has been kept; please try again.",
      errors: {},
    },
    { status: 500 }
  );
}

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getCheckoutAuthorization(user, role);

  if (!authorization.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: authorization.code,
        message:
          authorization.status === 401
            ? "Sign in before placing an order."
            : "Only customer accounts can place pickup orders.",
        errors: {},
      },
      { status: authorization.status }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "CHECKOUT_INVALID",
        message: "The checkout request could not be read.",
        errors: {},
      },
      { status: 400 }
    );
  }

  try {
    const checkout = validateCheckoutPayload(payload, getPaymentAvailability());
    const order = await createPickupOrderForCustomer(user.id, checkout);

    return NextResponse.json(
      {
        ok: true,
        status: order.idempotent ? "already_created" : "created",
        order: {
          reference: order.reference,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          totalMinor: order.totalMinor,
          currency: order.currency,
        },
        redirectTo: `/account/orders/${encodeURIComponent(order.reference)}?${order.paymentStatus === "PAID" ? "payment=success" : order.paymentInitializationFailed ? "payment=failed" : order.paymentInitializationPending ? "payment=pending" : "placed=1"}`,
        ...(order.paymentCheckout
          ? { paymentRedirectTo: order.paymentCheckout.authorizationUrl }
          : {}),
      },
      { status: order.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
