import { NextResponse } from "next/server";

import {
  AdminOrderingMutationError,
  mutateAdminOrderingOperations,
} from "@/lib/admin/operations";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { prepareOrderingAdminMutation } from "@/lib/ordering/admin-validation";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role, "/admin/operations");

  if (!authorization.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: user ? "Admin access is required." : "Authentication is required.",
      },
      { status: user ? 403 : 401 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "The ordering operations request could not be read." },
      { status: 400 }
    );
  }

  let mutation;
  try {
    mutation = prepareOrderingAdminMutation(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof TypeError
            ? error.message
            : "The ordering operations request is invalid.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await mutateAdminOrderingOperations({
      adminUserId: user.id,
      mutation,
    });
    const messages = {
      SAVE_SCHEDULE: "Weekly ordering schedule saved.",
      SET_OVERRIDE: `${mutation.data.mode === "OPEN" ? "Open" : "Closed"} override activated.`,
      CLEAR_OVERRIDE: "Ordering override cleared.",
      PAUSE: "New online orders paused.",
      RESUME: "Emergency pause removed.",
    };

    return NextResponse.json({
      ok: true,
      message: messages[mutation.action] || "Ordering operations updated.",
      result,
    });
  } catch (error) {
    console.error("[admin-ordering-operations]", {
      category: error?.code || error?.name || "mutation_failed",
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof AdminOrderingMutationError
            ? error.message
            : "Ordering operations could not be updated. Refresh and try again.",
      },
      { status: error instanceof AdminOrderingMutationError ? error.status : 500 }
    );
  }
}
