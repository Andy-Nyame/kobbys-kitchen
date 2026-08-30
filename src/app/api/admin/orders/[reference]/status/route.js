import { NextResponse } from "next/server";

import { mutateAdminOrder } from "@/lib/admin/orders";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { prepareAdminOrderMutation } from "@/lib/orders/admin-domain";
import { AdminOrderMutationError } from "@/lib/orders/admin-mutations";
import { PickupWorkflowError } from "@/lib/pickup/domain";

export async function POST(request, { params }) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role, "/admin/orders");
  if (!authorization.allowed) {
    return NextResponse.json(
      { ok: false, message: user ? "Admin access is required." : "Authentication is required." },
      { status: user ? 403 : 401 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "The order request could not be read." }, { status: 400 });
  }

  try {
    const { reference } = await params;
    const mutation = prepareAdminOrderMutation({ ...payload, reference });
    const result = await mutateAdminOrder({ adminUserId: user.id, mutation });
    return NextResponse.json({ ok: true, message: "Order status updated.", order: result });
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    if (error instanceof AdminOrderMutationError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (error instanceof PickupWorkflowError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error("[admin-order-status]", { category: error?.code || error?.name || "mutation_failed" });
    return NextResponse.json(
      { ok: false, message: "The order could not be updated. Refresh and try again." },
      { status: 500 }
    );
  }
}
