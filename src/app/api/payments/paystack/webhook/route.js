import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizePaystackReference, PaymentDomainError } from "@/lib/payments/domain";
import {
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/payments/providers/paystack";
import {
  finalizeVerifiedPaystackPayment,
  processPaystackRefundEvent,
} from "@/lib/payments/service";

const REFUND_EVENTS = new Set([
  "refund.pending",
  "refund.processing",
  "refund.processed",
  "refund.failed",
  "refund.needs-attention",
]);

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  try {
    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (event.event === "charge.success") {
      const reference = normalizePaystackReference(event.data?.reference);
      const verified = await verifyPaystackTransaction(reference);
      await finalizeVerifiedPaystackPayment({ prismaClient: prisma, reference, verified });
    } else if (REFUND_EVENTS.has(event.event)) {
      await processPaystackRefundEvent({
        prismaClient: prisma,
        event: { type: event.event, data: event.data },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PaymentDomainError && error.code === "PAYMENT_REFERENCE_UNKNOWN") {
      return NextResponse.json({ ok: true, ignored: true });
    }
    console.error("[paystack-webhook]", { category: error?.code || error?.name || "processing_failed" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
