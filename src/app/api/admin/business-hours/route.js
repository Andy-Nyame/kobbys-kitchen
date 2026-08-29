import { NextResponse } from "next/server";

import {
  AdminBusinessHoursMutationError,
  mutateAdminBusinessHours,
} from "@/lib/admin/business-hours";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { prepareBusinessHoursMutation } from "@/lib/business-hours/admin-validation";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role, "/admin/settings");
  if (!authorization.allowed) {
    return NextResponse.json(
      { ok: false, message: user ? "Admin access is required." : "Authentication is required." },
      { status: user ? 403 : 401 }
    );
  }

  let mutation;
  try {
    mutation = prepareBusinessHoursMutation(await request.json());
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof TypeError ? error.message : "The business-hours request is invalid." },
      { status: 400 }
    );
  }

  try {
    const result = await mutateAdminBusinessHours({ adminUserId: user.id, mutation });
    return NextResponse.json({ ok: true, message: "Physical business hours saved.", result });
  } catch (error) {
    console.error("[admin-business-hours]", { category: error?.code || error?.name || "mutation_failed" });
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof AdminBusinessHoursMutationError
          ? error.message
          : "Business hours could not be updated. Refresh and try again.",
      },
      { status: error instanceof AdminBusinessHoursMutationError ? error.status : 500 }
    );
  }
}
