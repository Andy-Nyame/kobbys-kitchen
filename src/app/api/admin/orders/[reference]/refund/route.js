import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { PaymentDomainError, prepareFullRefundRequest } from "@/lib/payments/domain";
import { initiateFullPaystackRefund } from "@/lib/payments/service";
import { prisma } from "@/lib/prisma";

export async function POST(request, { params }) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user) return NextResponse.json({ ok: false, message: "Authentication is required." }, { status: 401 });
  if (role !== "ADMIN") return NextResponse.json({ ok: false, message: "Admin access is required." }, { status: 403 });

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      throw new PaymentDomainError("REFUND_INVALID", "The refund request is invalid.", 400);
    }
    const payload = prepareFullRefundRequest(body);
    const { reference } = await params;
    const result = await initiateFullPaystackRefund({
      prismaClient: prisma,
      adminUserId: user.id,
      orderReference: reference,
      reason: payload.reason,
    });
    return NextResponse.json({
      ok: true,
      message: result.idempotent ? "Refund was already initiated." : "Order cancelled and full refund initiated.",
      refundStatus: result.refund.status,
    });
  } catch (error) {
    if (error instanceof PaymentDomainError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("[admin-paystack-refund]", { category: error?.code || error?.name || "refund_failed" });
    return NextResponse.json({ ok: false, message: "The refund could not be initiated. Review it in Paystack before retrying." }, { status: 500 });
  }
}
