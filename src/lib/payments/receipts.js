import { createReceiptNumber, PaymentDomainError } from "./domain.js";

export async function issueReceipt({
  client,
  paymentId,
  issuedById = null,
  now = new Date(),
  generateNumber = createReceiptNumber,
}) {
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, receipt: { select: { id: true, receiptNumber: true } } },
  });
  if (!payment || payment.status !== "PAID") {
    throw new PaymentDomainError(
      "RECEIPT_PAYMENT_REQUIRED",
      "A receipt can only be issued after payment is confirmed."
    );
  }
  if (payment.receipt) return { ...payment.receipt, idempotent: true };

  const receipt = await client.receipt.create({
    data: {
      receiptNumber: generateNumber(now),
      paymentId,
      issuedById,
      issuedAt: now,
    },
    select: { id: true, receiptNumber: true },
  });
  return { ...receipt, idempotent: false };
}

const receiptOrderSelect = {
  receiptNumber: true,
  issuedAt: true,
  payment: {
    select: {
      method: true,
      status: true,
      provider: true,
      providerRef: true,
      amountMinor: true,
      currency: true,
      order: {
        select: {
          reference: true,
          userId: true,
          customerNameSnapshot: true,
          fulfillmentType: true,
          totalMinor: true,
          currency: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              nameSnapshot: true,
              priceTier: true,
              unitPriceMinor: true,
              quantity: true,
              lineTotalMinor: true,
            },
          },
        },
      },
      refund: { select: { status: true, amountMinor: true, processedAt: true } },
    },
  },
};

export async function getAuthorizedReceipt({ prismaClient, reference, userId, role }) {
  if (!userId || (role !== "CUSTOMER" && role !== "ADMIN")) return null;
  return prismaClient.receipt.findFirst({
    where: {
      payment: {
        order: {
          reference,
          ...(role === "CUSTOMER" ? { userId } : {}),
        },
      },
    },
    select: receiptOrderSelect,
  });
}
