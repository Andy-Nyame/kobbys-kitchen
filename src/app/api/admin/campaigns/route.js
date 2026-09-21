import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  AdminCampaignMutationError,
} from "@/lib/campaigns/admin-mutations";
import { mutateAdminCampaign } from "@/lib/campaigns/admin-server";
import { prepareCampaignMutation } from "@/lib/campaigns/admin-validation";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role, "/admin/campaigns");

  if (!authorization.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: user ? "Admin access is required." : "Authentication is required.",
      },
      { status: user ? 403 : 401 }
    );
  }

  let mutation;
  try {
    mutation = prepareCampaignMutation(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof TypeError ? error.message : "The campaign request is invalid.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await mutateAdminCampaign({
      adminUserId: user.id,
      mutation,
    });
    revalidatePath("/");
    revalidatePath("/admin/campaigns");

    return NextResponse.json({
      ok: true,
      message: "Campaign settings saved.",
      result,
    });
  } catch (error) {
    console.error("[admin-campaigns]", {
      category: error?.code || error?.name || "mutation_failed",
    });
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof AdminCampaignMutationError
          ? error.message
          : "Campaign settings could not be updated. Refresh and try again.",
      },
      { status: error instanceof AdminCampaignMutationError ? error.status : 500 }
    );
  }
}
