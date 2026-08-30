import { NextResponse } from "next/server";

import { getCustomerAccess } from "@/lib/auth/guards";
import { getPublicOrderingStatus } from "@/lib/ordering/server";
import { getCustomerActiveOrderOverview } from "@/lib/orders/customer-orders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [orderingStatus, { user, role }] = await Promise.all([
      getPublicOrderingStatus(),
      getCustomerAccess(),
    ]);
    const customerOverview =
      user && role === "CUSTOMER"
        ? await getCustomerActiveOrderOverview(user.id)
        : null;

    return NextResponse.json(
      { ok: true, orderingStatus, customerOverview },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[operational-status]", {
      reason: error?.code || "refresh_failed",
    });
    return NextResponse.json(
      { ok: false, message: "Operational status is temporarily unavailable." },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  }
}
