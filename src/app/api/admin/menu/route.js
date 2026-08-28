import { NextResponse } from "next/server";

import {
  AdminMenuMutationError,
  mutateAdminMenu,
} from "@/lib/admin/menu";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { prepareMenuAdminMutation } from "@/lib/menu/admin-validation";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role);

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
      { ok: false, message: "The menu request could not be read." },
      { status: 400 }
    );
  }

  let mutation;

  try {
    mutation = prepareMenuAdminMutation(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof TypeError ? error.message : "The menu request is invalid.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await mutateAdminMenu({
      adminUserId: user.id,
      mutation,
    });

    return NextResponse.json(
      { ok: true, message: "Menu catalogue updated.", result },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin-menu-mutation]", {
      category: error?.code || error?.name || "mutation_failed",
    });

    const status =
      error instanceof AdminMenuMutationError
        ? error.status
        : error?.code === "P2002"
          ? 409
          : 500;

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof AdminMenuMutationError
            ? error.message
            : error?.code === "P2002"
              ? "That category, menu item or image already exists."
              : "The menu could not be updated. Refresh and try again.",
      },
      { status }
    );
  }
}
