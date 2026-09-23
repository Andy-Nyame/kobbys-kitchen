import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  AdminPaymentSettingError,
  prepareCashOnPickupSetting,
} from "@/lib/admin/payment-settings";
import { updateCashOnPickupSetting } from "@/lib/admin/payment-settings-server";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";

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

  let setting;
  try {
    setting = prepareCashOnPickupSetting(await request.json());
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof TypeError ? error.message : "The payment-method setting request is invalid." },
      { status: 400 }
    );
  }

  try {
    const result = await updateCashOnPickupSetting({
      adminUserId: user.id,
      cashOnPickupEnabled: setting.cashOnPickupEnabled,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/checkout");
    return NextResponse.json({
      ok: true,
      message: `Cash on Pickup ${result.cashOnPickupEnabled ? "enabled" : "disabled"}.`,
      result,
    });
  } catch (error) {
    console.error("[admin-payment-settings]", {
      category: error?.code || error?.name || "mutation_failed",
    });
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof AdminPaymentSettingError
          ? error.message
          : "Payment settings could not be updated. Refresh and try again.",
      },
      { status: error instanceof AdminPaymentSettingError ? error.status : 500 }
    );
  }
}
