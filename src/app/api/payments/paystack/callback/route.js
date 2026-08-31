import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSafeSiteUrl, normalizePaystackReference } from "@/lib/payments/domain";
import { verifyPaystackTransaction } from "@/lib/payments/providers/paystack";
import {
  finalizeVerifiedPaystackPayment,
  markPaystackPaymentNotSuccessful,
} from "@/lib/payments/service";

function resultUrl(path) {
  return new URL(path, getSafeSiteUrl());
}

export async function GET(request) {
  let reference;
  try {
    reference = normalizePaystackReference(new URL(request.url).searchParams.get("reference"));
    const verified = await verifyPaystackTransaction(reference);
    if (verified.status !== "success") {
      const failed = await markPaystackPaymentNotSuccessful({
        prismaClient: prisma,
        reference,
        providerStatus: verified.status,
      });
      return NextResponse.redirect(
        resultUrl(failed?.orderReference
          ? `/account/orders/${encodeURIComponent(failed.orderReference)}?payment=failed`
          : "/account/orders?payment=failed")
      );
    }
    const result = await finalizeVerifiedPaystackPayment({ prismaClient: prisma, reference, verified });
    return NextResponse.redirect(
      resultUrl(`/account/orders/${encodeURIComponent(result.orderReference)}?payment=success`)
    );
  } catch (error) {
    console.error("[paystack-callback]", { category: error?.code || error?.name || "verification_failed" });
    return NextResponse.redirect(resultUrl("/account/orders?payment=verification_failed"));
  }
}
