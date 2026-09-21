import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { AdminPromoMutationError } from "@/lib/promos/admin-mutations";
import { mutateAdminPromo } from "@/lib/promos/admin-server";
import { preparePromoMutation } from "@/lib/promos/admin-validation";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role, "/admin/promos");
  if (!authorization.allowed) {
    return NextResponse.json(
      { ok: false, message: user ? "Admin access is required." : "Authentication is required." },
      { status: user ? 403 : 401 }
    );
  }
  let mutation;
  try {
    mutation = preparePromoMutation(await request.json());
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof TypeError ? error.message : "The promo request is invalid." },
      { status: 400 }
    );
  }
  try {
    const result = await mutateAdminPromo({ adminUserId: user.id, mutation });
    revalidatePath("/admin/promos");
    return NextResponse.json({ ok: true, message: "Promo settings saved.", result });
  } catch (error) {
    console.error("[admin-promos]", { category: error?.code || error?.name || "mutation_failed" });
    const known = error instanceof AdminPromoMutationError;
    return NextResponse.json(
      { ok: false, message: known ? error.message : error?.code === "P2002" ? "That promo code already exists." : "Promo settings could not be saved." },
      { status: known ? error.status : error?.code === "P2002" ? 409 : 500 }
    );
  }
}
