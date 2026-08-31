import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { assertOrderingOpenForSubmission } from "@/lib/ordering/server";
import { PaymentDomainError } from "@/lib/payments/domain";
import { retryPaystackPayment } from "@/lib/payments/service";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user) return NextResponse.json({ ok: false, message: "Authentication is required." }, { status: 401 });
  if (role !== "CUSTOMER") return NextResponse.json({ ok: false, message: "Customer access is required." }, { status: 403 });

  try {
    const payload = await request.json();
    const result = await retryPaystackPayment({
      prismaClient: prisma,
      userId: user.id,
      orderReference: payload?.orderReference,
      assertOrderingOpen: assertOrderingOpenForSubmission,
    });
    return NextResponse.json({ ok: true, redirectTo: result.authorizationUrl });
  } catch (error) {
    if (error instanceof PaymentDomainError || error?.code === "ORDERING_CLOSED") {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status || 409 }
      );
    }
    console.error("[paystack-retry]", { category: error?.code || error?.name || "retry_failed" });
    return NextResponse.json({ ok: false, message: "Payment could not be restarted." }, { status: 500 });
  }
}
