import "server-only";

import { assertOrderingOpenForSubmission } from "@/lib/ordering/server";
import { prisma } from "@/lib/prisma";
import { createTrustedPickupOrder } from "./checkout-service.js";
import { initializeNewOrderPayment } from "@/lib/payments/service";
import { PaymentDomainError } from "@/lib/payments/domain";

export async function createPickupOrderForCustomer(userId, checkout) {
  const order = await createTrustedPickupOrder({
    prismaClient: prisma,
    userId,
    checkout,
    assertOrderingOpen: assertOrderingOpenForSubmission,
  });
  try {
    const paymentCheckout = await initializeNewOrderPayment({ prismaClient: prisma, order });
    return { ...order, paymentCheckout, paymentInitializationFailed: false };
  } catch (error) {
    if (error instanceof PaymentDomainError) {
      return {
        ...order,
        paymentCheckout: null,
        paymentInitializationFailed: error.code !== "PAYMENT_ATTEMPT_BUSY",
        paymentInitializationPending: error.code === "PAYMENT_ATTEMPT_BUSY",
      };
    }
    throw error;
  }
}
